const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const database = require('../database/database');
const ProtoLoader = require('../utils/protoLoader');

class TaskService {
    constructor() {
        this.streamingSessions = new Map(); // Para gerenciar streams ativos
        this.taskStreams = new Map(); // Para streamTasks
        this.chatClients = new Map(); // Para gerenciar conexões bidirecionais

    }

    /**
     * Middleware para validação de token
     */
    async validateToken(token) {
        const jwtSecret = process.env.JWT_SECRET || 'seu-secret-aqui';
        try {
            return jwt.verify(token, jwtSecret);
        } catch (error) {
            const err = new Error('Token inválido');
            err.code = grpc.status.UNAUTHENTICATED;
            throw err;
        }
    }

    /**
     * Criar tarefa
     */
    async createTask(call, callback) {
        try {
            const { token, title, description, priority } = call.request;

            const user = await this.validateToken(token);

            if (!title?.trim()) {
                const err = new Error('Título é obrigatório');
                err.code = grpc.status.INVALID_ARGUMENT;
                return callback(err);
            }

            const taskData = {
                id: uuidv4(),
                title: title.trim(),
                description: description || '',
                priority: ProtoLoader.convertFromPriority(priority),
                userId: user.id,
                completed: false
            };

            const task = new Task(taskData);
            const validation = task.validate();

            if (!validation.isValid) {
                const err = new Error('Dados inválidos: ' + validation.errors.join(', '));
                err.code = grpc.status.INVALID_ARGUMENT;
                return callback(err);
            }

            await database.run(
                'INSERT INTO tasks (id, title, description, priority, userId) VALUES (?, ?, ?, ?, ?)',
                [task.id, task.title, task.description, task.priority, task.userId]
            );

            this.notifyStreams('TASK_CREATED', task);

            callback(null, {
                success: true,
                message: 'Tarefa criada com sucesso',
                task: task.toProtobuf()
            });

        } catch (error) {
            console.error('Erro ao criar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Listar tarefas
     */
    async getTasks(call, callback) {
        try {
            const { token, completed, priority, page, limit } = call.request;
            const user = await this.validateToken(token);

            let sql = 'SELECT * FROM tasks WHERE userId = ?';
            const params = [user.id];

            if (completed !== undefined && completed !== null) {
                sql += ' AND completed = ?';
                params.push(completed ? 1 : 0);
            }

            if (priority !== undefined && priority !== null) {
                const priorityStr = ProtoLoader.convertFromPriority(priority);
                sql += ' AND priority = ?';
                params.push(priorityStr);
            }

            sql += ' ORDER BY createdAt DESC';

            const pageNum = page || 1;
            const limitNum = Math.min(limit || 10, 100);

            const result = await database.getAllWithPagination(sql, params, pageNum, limitNum);
            const tasks = result.rows.map(row => new Task({ ...row, completed: row.completed === 1 }).toProtobuf());

            callback(null, {
                success: true,
                tasks,
                total: result.total,
                page: result.page,
                limit: result.limit
            });

        } catch (error) {
            console.error('Erro ao buscar tarefas:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Buscar tarefa específica
     */
    async getTask(call, callback) {
        try {
            const { token, task_id } = call.request;
            const user = await this.validateToken(token);

            const row = await database.get(
                'SELECT * FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            if (!row) {
                const err = new Error('Tarefa não encontrada');
                err.code = grpc.status.NOT_FOUND;
                return callback(err);
            }

            const task = new Task({ ...row, completed: row.completed === 1 });

            callback(null, {
                success: true,
                message: 'Tarefa encontrada',
                task: task.toProtobuf()
            });

        } catch (error) {
            console.error('Erro ao buscar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }



    /**
     * Atualizar tarefa
     */
    async updateTask(call, callback) {
        try {
            const { token, task_id, title, description, completed, priority } = call.request;
            const user = await this.validateToken(token);

            const existingTask = await database.get(
                'SELECT * FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            if (!existingTask) {
                const err = new Error('Tarefa não encontrada');
                err.code = grpc.status.NOT_FOUND;
                return callback(err);
            }

            const updateData = {
                title: title || existingTask.title,
                description: description ?? existingTask.description,
                completed: completed ?? (existingTask.completed === 1),
                priority: priority !== undefined ? ProtoLoader.convertFromPriority(priority) : existingTask.priority
            };

            const result = await database.run(
                'UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
                [updateData.title, updateData.description, updateData.completed ? 1 : 0, updateData.priority, task_id, user.id]
            );

            if (result.changes === 0) {
                const err = new Error('Falha ao atualizar tarefa');
                err.code = grpc.status.INTERNAL;
                return callback(err);
            }

            const updatedRow = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);
            const task = new Task({ ...updatedRow, completed: updatedRow.completed === 1 });

            this.notifyStreams('TASK_UPDATED', task);

            callback(null, {
                success: true,
                message: 'Tarefa atualizada com sucesso',
                task: task.toProtobuf()
            });

        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Deletar tarefa
     */
    async deleteTask(call, callback) {
        try {
            const { token, task_id } = call.request;
            const user = await this.validateToken(token);

            const existingTask = await database.get('SELECT * FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);

            if (!existingTask) {
                const err = new Error('Tarefa não encontrada');
                err.code = grpc.status.NOT_FOUND;
                return callback(err);
            }

            const result = await database.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [task_id, user.id]);

            if (result.changes === 0) {
                const err = new Error('Falha ao deletar tarefa');
                err.code = grpc.status.INTERNAL;
                return callback(err);
            }

            const task = new Task({ ...existingTask, completed: existingTask.completed === 1 });
            this.notifyStreams('TASK_DELETED', task);

            callback(null, {
                success: true,
                message: 'Tarefa deletada com sucesso'
            });

        } catch (error) {
            console.error('Erro ao deletar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
 * Obter estatísticas de tarefas
 */


    async getTaskStats(call, callback) {
        try {
            const { token } = call.request;
            const user = await this.validateToken(token);

            const totalResult = await database.get('SELECT COUNT(*) as count FROM tasks WHERE userId = ?', [user.id]);
            const completedResult = await database.get('SELECT COUNT(*) as count FROM tasks WHERE userId = ? AND completed = 1', [user.id]);
            const pendingResult = await database.get('SELECT COUNT(*) as count FROM tasks WHERE userId = ? AND completed = 0', [user.id]);

            const total = Number(totalResult?.count ?? 0);
            const completed = Number(completedResult?.count ?? 0);
            const pending = Number(pendingResult?.count ?? 0);
            const completion_rate = total > 0 ? completed / total : 0;


            callback(null, {
                success: true,
                stats: {
                    total: total || 0,
                    completed: completed || 0,
                    pending: pending || 0,
                    completion_rate: Number(completion_rate.toFixed(4)) // garante que seja double
                }
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas de tarefas:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.code || grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
 * Notifica todas as streams ativas sobre alterações de tarefas
 * @param {string} type Tipo de evento ('TASK_CREATED', 'TASK_UPDATED', 'TASK_DELETED')
 * @param {Task} task Instância da tarefa afetada
 */
    notifyStreams(type, task) {
        // Notificações padrão
        for (const [callId, call] of this.streamingSessions.entries()) {
            try {
                call.write({
                    type,
                    task: task.toProtobuf(),
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (err) {
                console.error('Erro ao notificar streamNotifications:', err);
            }
        }

        // Envia também para StreamTasks
        for (const [callId, call] of this.taskStreams.entries()) {
            try {
                call.write(task.toProtobuf());
            } catch (err) {
                console.error('Erro ao notificar streamTasks:', err);
            }
        }
    }

    /**
     * Servidor stream (server-side streaming) para listar tarefas e
     * receber atualizações em tempo real.
     */
    streamTasks(call) {
        const streamId = uuidv4();
        this.taskStreams.set(streamId, call);
        console.log(`Nova sessão de stream de tarefas iniciada. Total: ${this.taskStreams.size}`);

        // Envia todas as tarefas existentes do usuário
        this.validateToken(call.request.token)
            .then(async (user) => {
                const rows = await database.getAll('SELECT * FROM tasks WHERE userId = ?', [user.id]);
                rows.forEach(row => {
                    const task = new Task({ ...row, completed: row.completed === 1 });
                    call.write(task.toProtobuf());
                });
            })
            .catch(err => {
                console.error('Token inválido no streamTasks:', err);
                call.end();
            });

        // Recebe finalização da conexão
        call.on('end', () => {
            this.taskStreams.delete(streamId);
            console.log(`Sessão de stream de tarefas finalizada. Total: ${this.taskStreams.size}`);
            call.end();
        });

        call.on('error', (err) => {
            this.taskStreams.delete(streamId);
            console.error('Erro na sessão de stream de tarefas:', err);
        });
    }

    /**
     * Servidor stream (server-side streaming) para notificar atualizações de tarefas.
     */
    streamNotifications(call) {
        const streamId = uuidv4();       // gera ID único
        this.streamingSessions.set(streamId, call);
        console.log(`Nova sessão de stream para notificações iniciada. Total: ${this.streamingSessions.size}`);

        call.on('end', () => {
            this.streamingSessions.delete(streamId);
            console.log(`Sessão de stream para notificações finalizada. Total: ${this.streamingSessions.size}`);
        });

        call.on('error', (err) => {
            this.streamingSessions.delete(streamId);
            console.error('Erro na sessão de stream:', err);
        });
    }

    /**
     * Chat bidirecional: streaming cliente-servidor
     * @param {grpc.ServerDuplexStream} call
     */
    chat(call) {
        const clientId = uuidv4();
        this.chatClients.set(clientId, call);
        console.log(`Novo cliente de chat conectado. Total: ${this.chatClients.size}`);

        // Quando o cliente envia uma mensagem
        call.on('data', (message) => {
            const timestamp = Math.floor(Date.now() / 1000);
            const msg = {
                user_id: message.user_id,
                message: message.message,
                timestamp
            };

            // Distribuir mensagem para todos os clientes, exceto o próprio remetente
            for (const [id, clientCall] of this.chatClients.entries()) {
                if (id === clientId) continue; // ignora a própria conexão
                try {
                    clientCall.write(msg);
                } catch (err) {
                    console.error('Erro ao enviar mensagem para cliente:', err);
                }
            }
        });

        // Quando o cliente encerra o stream
        call.on('end', () => {
            this.chatClients.delete(clientId);
            console.log(`Cliente de chat desconectado. Total: ${this.chatClients.size}`);
            call.end();
        });

        // Quando ocorre algum erro no stream
        call.on('error', (err) => {
            this.chatClients.delete(clientId);
            console.error('Erro no stream de chat:', err);
        });
    }

    // Aqui entram os outros métodos já existentes: createTask, getTasks, updateTask, deleteTask, etc.

}




module.exports = TaskService;
