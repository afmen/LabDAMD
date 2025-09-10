const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('./utils/protoLoader');



/**
 * Cliente gRPC de Exemplo
 * 
 * Demonstra como consumir serviços gRPC de forma eficiente,
 * incluindo streaming de dados em tempo real
 */

class GrpcClient {
    constructor(servers = ['localhost:50051', 'localhost:50052', 'localhost:50053']) {
        this.servers = servers;
        this.protoLoader = new ProtoLoader();
        this.authClient = null;
        this.authClients = [];   // array de AuthService
        this.taskClients = [];   // array de TaskService
        this.currentAuthIndex = 0;  // índice round-robin específico para Auth
        this.currentTaskIndex = 0;
        this.currentToken = null;
    }

    async initialize() {
        try {
            const { servicePackage: authProto } = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const { servicePackage: taskProto } = this.protoLoader.loadProto('task_service.proto', 'tasks');


            const credentials = grpc.credentials.createInsecure();

            // Criar clients individuais para cada servidor
            this.authClients = this.servers.map(addr => new authProto.AuthService(addr, credentials));
            this.taskClients = this.servers.map(addr => new taskProto.TaskService(addr, credentials));

            // Inicializa índice round-robin
            this.currentIndex = 0;

            console.log('✅ Cliente gRPC inicializado com round-robin manual');
        } catch (error) {
            console.error('❌ Erro na inicialização do cliente:', error);
            throw error;
        }
    }

    getNextAuthClient() {
        const client = this.authClients[this.currentAuthIndex];
        this.currentAuthIndex = (this.currentAuthIndex + 1) % this.authClients.length;
        return client;
    }

    getNextTaskClient() {
        const client = this.taskClients[this.currentTaskIndex];
        this.currentTaskIndex = (this.currentTaskIndex + 1) % this.taskClients.length;
        return client;
    }


    // Promisificar chamadas gRPC
    promisify(client, method) {
        return (request) => {
            return new Promise((resolve, reject) => {
                client[method](request, (error, response) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        };
    }

    async register(userData) {
        const registerPromise = this.promisify(this.getNextAuthClient(), 'Register');
        return await registerPromise(userData);
    }

    async login(credentials) {
        const loginPromise = this.promisify(this.getNextAuthClient(), 'Login');
        const response = await loginPromise(credentials);

        if (response.success) {
            this.currentToken = response.token;
            console.log('🔑 Token obtido com sucesso');
        }

        return response;
    }

    async createTask(taskData) {
        const createPromise = this.promisify(this.getNextTaskClient(), 'CreateTask');
        return await createPromise({
            token: this.currentToken,
            ...taskData
        });
    }

    async getTasks(filters = {}) {
        const getTasksPromise = this.promisify(this.getNextTaskClient(), 'GetTasks');
        return await getTasksPromise({
            token: this.currentToken,
            ...filters
        });
    }


    async getTask(taskId) {
        const getTaskPromise = this.promisify(this.getNextTaskClient(), 'GetTask');
        return await getTaskPromise({
            token: this.currentToken,
            task_id: taskId
        });
    }

    async updateTask(taskId, updates) {
        const updatePromise = this.promisify(this.getNextTaskClient(), 'UpdateTask');
        return await updatePromise({
            token: this.currentToken,
            task_id: taskId,
            ...updates
        });
    }

    async deleteTask(taskId) {
        const deletePromise = this.promisify(this.getNextTaskClient(), 'DeleteTask');
        return await deletePromise({
            token: this.currentToken,
            task_id: taskId
        });
    }

    async getStats() {
        const statsPromise = this.promisify(this.getNextTaskClient(), 'GetTaskStats');
        return await statsPromise({
            token: this.currentToken
        });
    }

    // Demonstração de streaming
    streamTasks(filters = {}) {
        const stream = this.getNextTaskClient().StreamTasks({
            token: this.currentToken,
            ...filters
        });

        stream.on('data', (task) => {
            console.log('📋 Tarefa recebida via stream:', {
                id: task.id,
                title: task.title,
                completed: task.completed
            });
        });

        stream.on('end', () => {
            console.log('📋 Stream de tarefas finalizado');
        });

        stream.on('error', (error) => {
            console.error('❌ Erro no stream de tarefas:', error);
        });

        return stream;
    }




    streamNotifications() {
        const stream = this.getNextTaskClient().StreamNotifications({
            token: this.currentToken
        });

        stream.on('data', (notification) => {
            const typeMap = ['CREATED', 'UPDATED', 'DELETED', 'COMPLETED'];
            console.log('🔔 Notificação:', {
                type: typeMap[notification.type],
                message: notification.message,
                task: notification.task ? notification.task.title : null,
                timestamp: new Date(parseInt(notification.timestamp) * 1000)
            });
        });

        stream.on('end', () => {
            console.log('🔔 Stream de notificações finalizado');
        });

        stream.on('error', (error) => {
            console.error('❌ Erro no stream de notificações:', error);
        });

        return stream;
    }




    chat() {
        const stream = this.getNextTaskClient().Chat();

        stream.on('data', (message) => {
            console.log(`[📩] ${message.user_id}: ${message.message} (${new Date(message.timestamp * 1000).toLocaleTimeString()})`);
        });

        stream.on('end', () => {
            console.log('Chat finalizado pelo servidor');
        });

        stream.on('error', (err) => {
            console.error('Erro no chat:', err);
        });

        // Retorna o stream para que possamos enviar mensagens
        return stream;
    }
}

// Demonstração de uso
async function demonstrateGrpcClient() {
    const client = new GrpcClient();

    try {
        await client.initialize();

        // 1. Registrar usuário
        console.log('\n1. Registrando usuário...');
        try {
            const registerResponse = await client.register({
                email: 'usuario@teste.com',
                username: 'usuarioteste',
                password: 'senha123',
                first_name: 'João',
                last_name: 'Silva'
            });
            console.log('Registro:', registerResponse.message);
        } catch (error) {
            if (error.code === 6) { // grpc.status.ALREADY_EXISTS
                console.log('Usuário já existe, pulando registro...');
            } else {
                throw error; // outros erros são tratados normalmente
            }
        }

        // 2. Fazer login
        console.log('\n2. Fazendo login...');
        const loginResponse = await client.login({
            identifier: 'usuario@teste.com',
            password: 'senha123'
        });
        console.log('Login:', loginResponse.message);

        if (!loginResponse.success) {
            // Tentar login com usuário existente
            console.log('Tentando login novamente...');
            await client.login({
                identifier: 'usuario@teste.com',
                password: 'senha123'
            });
        }

        // 3. Criar tarefa
        console.log('\n3. Criando tarefa...');
        const createResponse = await client.createTask({
            title: 'Estudar gRPC',
            description: 'Aprender Protocol Buffers e streaming',
            priority: 2 // HIGH
        });
        console.log('Tarefa criada:', createResponse.message);

        // 4. Listar tarefas
        console.log('\n4. Listando tarefas...');
        const tasksResponse = await client.getTasks({ page: 1, limit: 10 });
        console.log(`Encontradas ${tasksResponse.tasks.length} tarefas`);



        // 5. Buscar tarefa específica
        if (tasksResponse.tasks.length > 0) {
            console.log('\n5. Buscando tarefa específica...');
            const taskResponse = await client.getTask(tasksResponse.tasks[0].id);
            console.log('Tarefa encontrada:', taskResponse.task.title);
        }

        // 6. Estatísticas
        console.log('\n6. Estatísticas...');
        const statsResponse = await client.getStats();
        if (statsResponse.success && statsResponse.stats) {
            const s = statsResponse.stats;
            console.log('Stats:', {
                total: s.total,
                completed: s.completed,
                pending: s.pending,
                completion_rate: s.completion_rate
            });
        } else {
            console.log('Não foi possível obter estatísticas:', statsResponse.message || 'Resposta inválida');
        }

        // 7. Demonstrar chat bidirecional
        console.log('\n5. Iniciando chat bidirecional...');
        const userId = 'user_' + Math.floor(Math.random() * 10000);
        console.log('🔹 Iniciando chat como:', userId);

        const chatStream = client.chat();

        // Envia mensagens a cada 5 segundos
        const interval = setInterval(() => {
            const timestamp = Math.floor(Date.now() / 1000);
            chatStream.write({
                user_id: userId,
                message: 'Olá, pessoal! Esta é a mensagem de ' + userId,
                timestamp
            });
        }, 5000);

        // Encerra chat após 30 segundos
        setTimeout(() => {
            chatStream.end();
            clearInterval(interval);
            console.log('Chat finalizado pelo cliente', userId);
        }, 30000);

        // Recebe mensagens de outros usuários
        chatStream.on('data', (msg) => {
            console.log(`[📩] ${msg.user_id}: ${msg.message} (${new Date(msg.timestamp * 1000).toLocaleTimeString()})`);
        });

        setTimeout(() => {
            chatStream.end();
            clearInterval(interval);
        }, 30000);

        // Encerrar chat após 30s
        setTimeout(() => {
            chatStream.end();
        }, 30000);

    } catch (error) {
        console.error('❌ Erro na demonstração:', error);
    }
}

// 7. Demonstrar streaming (comentado para evitar loop infinito)
// console.log('\n7. Iniciando stream de notificações...');
// const notificationStream = client.streamNotifications();

// Manter stream aberto por alguns segundos
// setTimeout(() => notificationStream.cancel(), 5000);




// Executar demonstração se arquivo for executado diretamente
if (require.main === module) {
    demonstrateGrpcClient();
}

module.exports = GrpcClient;