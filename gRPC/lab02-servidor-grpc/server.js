const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('./utils/protoLoader');
const AuthService = require('./services/AuthService');
const TaskService = require('./services/TaskService');
const database = require('./database/database');


/**
 * Servidor gRPC
 * 
 * Implementa comunicação de alta performance usando:
 * - Protocol Buffers para serialização eficiente
 * - HTTP/2 como protocolo de transporte
 * - Streaming bidirecional para tempo real
 * 
 * Segundo Google (2023), gRPC oferece até 60% melhor performance
 * comparado a REST/JSON em cenários de alta carga
 */

class GrpcServer {
    constructor(port) {
        this.port = port || 50051;
        this.server = new grpc.Server();
        this.protoLoader = new ProtoLoader();
        this.authService = new AuthService();
        this.taskService = new TaskService();
        
    }

    async initialize() {
        try {
            await database.init();

            // Carregar definições dos protobuf
            const { serviceDefinition: authServiceDefinition } = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const { serviceDefinition: taskServiceDefinition } = this.protoLoader.loadProto('task_service.proto', 'tasks');

            // Debug: verificar keys do service definition
            console.log('AuthServiceDefinition keys:', Object.keys(authServiceDefinition));
            console.log('TaskServiceDefinition keys:', Object.keys(taskServiceDefinition));

            // Registrar serviços de autenticação
            this.server.addService(authServiceDefinition, {
                Register: this.authService.register.bind(this.authService),
                Login: this.authService.login.bind(this.authService),
                ValidateToken: this.authService.validateToken.bind(this.authService)
            });

            // Registrar serviços de tarefas
            this.server.addService(taskServiceDefinition, {
                CreateTask: this.taskService.createTask.bind(this.taskService),
                GetTasks: this.taskService.getTasks.bind(this.taskService),
                GetTask: this.taskService.getTask.bind(this.taskService),
                UpdateTask: this.taskService.updateTask.bind(this.taskService),
                DeleteTask: this.taskService.deleteTask.bind(this.taskService),
                GetTaskStats: this.taskService.getTaskStats.bind(this.taskService),
                StreamTasks: this.taskService.streamTasks.bind(this.taskService),
                StreamNotifications: this.taskService.streamNotifications.bind(this.taskService),
                Chat: this.taskService.chat.bind(this.taskService)

            });


            console.log('✅ Serviços gRPC registrados com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const serverCredentials = grpc.ServerCredentials.createInsecure();
            this.server.bindAsync(`0.0.0.0:${this.port}`, serverCredentials, (error, boundPort) => {
                if (error) {
                    console.error('❌ Falha ao iniciar servidor:', error);
                    return;
                }

                console.log('🚀 =================================');
                console.log(`🚀 Servidor gRPC iniciado na porta ${boundPort}`);
                console.log(`🚀 Protocolo: gRPC/HTTP2`);
                console.log(`🚀 Serialização: Protocol Buffers`);
                console.log('🚀 Serviços disponíveis:');
                console.log('🚀   - AuthService (Register, Login, ValidateToken)');
                console.log('🚀   - TaskService (CRUD + Streaming)');
                console.log('🚀 =================================');
            });

            // Graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n⏳ Encerrando servidor...');
                this.server.tryShutdown((error) => {
                    if (error) {
                        console.error('❌ Erro ao encerrar servidor:', error);
                        process.exit(1);
                    } else {
                        console.log('✅ Servidor encerrado com sucesso');
                        process.exit(0);
                    }
                });
            });

        } catch (error) {
            console.error('❌ Falha na inicialização do servidor:', error);
            process.exit(1);
        }
    }
}

// Inicialização
// Inicialização
if (require.main === module) {
    // Prioridade: argumento > variável de ambiente > padrão
    const portArg = parseInt(process.argv[2]); // pega o argumento do node
    const portEnv = parseInt(process.env.GRPC_PORT);
    const port = portArg || portEnv || 50051;

    const server = new GrpcServer(port);
    server.start();
}


module.exports = GrpcServer;
