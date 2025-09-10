const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const database = require('../database/database');
const ProtoLoader = require('../utils/protoLoader');

class TaskService {
    constructor() {
        this.streamingSessions = new Map(); // Para gerenciar streams ativos
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
            const tasks = result.rows.map(row => new Task({...row, completed: row.completed === 1}).toProtobuf());

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

            const task = new Task({...row, completed: row.completed === 1});

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
            const task = new Task({...updatedRow, completed: updatedRow.completed === 1});

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

            const task = new Task({...existingTask, completed: existingTask.completed === 1});
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

    // Os métodos de stream (streamTasks e streamNotifications) podem manter call.destroy em caso de erro,
    // pois streaming lida diretamente com conexões abertas.
}

module.exports = TaskService;
