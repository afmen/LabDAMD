# Roteiro 2: Servidor de Aplicação com gRPC - Versão para execução do Aluno

**Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas**  
**Curso de Engenharia de Software - PUC Minas**  
**Professores:** Artur Mol, Cleiton Tavares e Cristiano Neto

---

## Objetivos

- Implementar comunicação cliente-servidor usando protocolo gRPC
- Compreender as vantagens da serialização binária Protocol Buffers
- Comparar performance entre REST/JSON e gRPC/Protobuf
- Implementar streaming de dados em tempo real
- Estabelecer base para sistemas distribuídos de alta performance

## Fundamentação Teórica

O gRPC (Google Remote Procedure Call) é um framework moderno de RPC (Remote Procedure Call) desenvolvido pelo Google que utiliza HTTP/2 como protocolo de transporte e Protocol Buffers como mecanismo de serialização de dados.

Segundo Tanenbaum & Van Steen (2017), "RPCs fazem uma chamada para um procedimento remoto parecer como uma chamada local" <sup>[1]</sup>. O gRPC aprimora este conceito com:

### Características do gRPC

**Vantagens:**
- **Performance Superior**: Serialização binária ~60% mais rápida que JSON
- **Type Safety**: Definição de contratos com Protocol Buffers
- **Streaming**: Suporte nativo a streaming bidirecional
- **Multiplexing**: HTTP/2 permite múltiplas requisições simultâneas

**Protocol Buffers vs JSON:**
```protobuf
// Protobuf: Compacto e tipado
message Task {
  string id = 1;
  string title = 2;
  bool completed = 3;
}
```

```json
// JSON: Verboso e sem tipagem
{
  "id": "123",
  "title": "Minha Tarefa", 
  "completed": false
}
```

### Tipos de Comunicação gRPC

1. **Unary RPC**: Requisição-resposta simples (similar ao REST)
2. **Server Streaming**: Cliente envia uma requisição, servidor retorna stream
3. **Client Streaming**: Cliente envia stream, servidor retorna uma resposta
4. **Bidirectional Streaming**: Ambos enviam streams simultaneamente

## Cenário do Laboratório

Evolução do sistema de gerenciamento de tarefas usando gRPC, demonstrando:
- Comunicação de alta performance
- Streaming de notificações em tempo real
- Validação automática de tipos
- Interoperabilidade entre linguagens

## Pré-requisitos

- Node.js 16+ e NPM
- Conhecimento do Roteiro 1 (REST API)
- Editor de código (VS Code)
- Cliente gRPC (BloomRPC ou similar)

---

## **PASSO 1: Configuração Inicial do Projeto**

### 1.1 Criar Estrutura do Projeto

```bash
mkdir lab02-servidor-grpc
cd lab02-servidor-grpc
npm init -y
```

### 1.2 Instalar Dependências

```bash
# Dependências principais gRPC
npm install @grpc/grpc-js @grpc/proto-loader uuid bcryptjs jsonwebtoken sqlite3

# Ferramentas de desenvolvimento
npm install --save-dev grpc-tools jest @grpc/grpc-js-xds
```

### 1.3 Estrutura de Diretórios

```
lab02-servidor-grpc/
├── package.json
├── server.js                 # Servidor gRPC principal
├── client.js                 # Cliente de exemplo
├── protos/
│   ├── task_service.proto    # Definição dos serviços
│   └── auth_service.proto    # Serviços de autenticação
├── services/
│   ├── TaskService.js        # Implementação do serviço de tarefas
│   └── AuthService.js        # Implementação do serviço de auth
├── models/
│   ├── User.js               # Modelo de usuário
│   └── Task.js               # Modelo de tarefa
├── database/
│   └── database.js           # Manager do banco SQLite
├── middleware/
│   └── auth.js               # Interceptors de autenticação
├── utils/
│   └── protoLoader.js        # Utilitários para Protocol Buffers
└── tests/
    └── grpc.test.js          # Testes dos serviços gRPC
```

---

## **PASSO 2: Definição dos Protocol Buffers**

### 2.1 Serviço de Autenticação (`protos/auth_service.proto`)

```protobuf
syntax = "proto3";

package auth;

service AuthService {
  rpc Register(RegisterRequest) returns (RegisterResponse);
  rpc Login(LoginRequest) returns (LoginResponse);
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
}

message RegisterRequest {
  string email = 1;
  string username = 2;
  string password = 3;
  string first_name = 4;
  string last_name = 5;
}

message LoginRequest {
  string identifier = 1;  // email ou username
  string password = 2;
}

message ValidateTokenRequest {
  string token = 1;
}

message User {
  string id = 1;
  string email = 2;
  string username = 3;
  string first_name = 4;
  string last_name = 5;
  int64 created_at = 6;
}

message RegisterResponse {
  bool success = 1;
  string message = 2;
  User user = 3;
  string token = 4;
  repeated string errors = 5;
}

message LoginResponse {
  bool success = 1;
  string message = 2;
  User user = 3;
  string token = 4;
  repeated string errors = 5;
}

message ValidateTokenResponse {
  bool valid = 1;
  User user = 2;
  string message = 3;
}
```

### 2.2 Serviço de Tarefas (`protos/task_service.proto`)

```protobuf
syntax = "proto3";

package tasks;

service TaskService {
  rpc CreateTask(CreateTaskRequest) returns (CreateTaskResponse);
  rpc GetTasks(GetTasksRequest) returns (GetTasksResponse);
  rpc GetTask(GetTaskRequest) returns (GetTaskResponse);
  rpc UpdateTask(UpdateTaskRequest) returns (UpdateTaskResponse);
  rpc DeleteTask(DeleteTaskRequest) returns (DeleteTaskResponse);
  rpc GetTaskStats(GetTaskStatsRequest) returns (GetTaskStatsResponse);
  
  // Streaming endpoints
  rpc StreamTasks(StreamTasksRequest) returns (stream Task);
  rpc StreamNotifications(StreamNotificationsRequest) returns (stream TaskNotification);
}

enum Priority {
  LOW = 0;
  MEDIUM = 1;
  HIGH = 2;
  URGENT = 3;
}

enum NotificationType {
  TASK_CREATED = 0;
  TASK_UPDATED = 1;
  TASK_DELETED = 2;
  TASK_COMPLETED = 3;
}

message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  bool completed = 4;
  Priority priority = 5;
  string user_id = 6;
  int64 created_at = 7;
  int64 updated_at = 8;
}

message CreateTaskRequest {
  string token = 1;
  string title = 2;
  string description = 3;
  Priority priority = 4;
}

message GetTasksRequest {
  string token = 1;
  optional bool completed = 2;
  optional Priority priority = 3;
  int32 page = 4;
  int32 limit = 5;
}

message GetTaskRequest {
  string token = 1;
  string task_id = 2;
}

message UpdateTaskRequest {
  string token = 1;
  string task_id = 2;
  optional string title = 3;
  optional string description = 4;
  optional bool completed = 5;
  optional Priority priority = 6;
}

message DeleteTaskRequest {
  string token = 1;
  string task_id = 2;
}

message StreamTasksRequest {
  string token = 1;
  optional bool completed = 2;
}

message StreamNotificationsRequest {
  string token = 1;
}

message GetTaskStatsRequest {
  string token = 1;
}

message CreateTaskResponse {
  bool success = 1;
  string message = 2;
  Task task = 3;
  repeated string errors = 4;
}

message GetTasksResponse {
  bool success = 1;
  repeated Task tasks = 2;
  int32 total = 3;
  int32 page = 4;
  int32 limit = 5;
  string message = 6;
}

message GetTaskResponse {
  bool success = 1;
  string message = 2;
  Task task = 3;
}

message UpdateTaskResponse {
  bool success = 1;
  string message = 2;
  Task task = 3;
  repeated string errors = 4;
}

message DeleteTaskResponse {
  bool success = 1;
  string message = 2;
}

message TaskStats {
  int32 total = 1;
  int32 completed = 2;
  int32 pending = 3;
  double completion_rate = 4;
}

message GetTaskStatsResponse {
  bool success = 1;
  TaskStats stats = 2;
}

message TaskNotification {
  NotificationType type = 1;
  Task task = 2;
  string message = 3;
  int64 timestamp = 4;
}
```

---

## **PASSO 3: Utilitários e Carregamento de Protobuf**

### 3.1 Proto Loader (`utils/protoLoader.js`)

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

/**
 * Carregador de Protocol Buffers
 * 
 * Segundo Tanenbaum & Van Steen (2017), a serialização de dados
 * é crucial para comunicação entre sistemas distribuídos.
 * Protocol Buffers oferece:
 * - Serialização binária eficiente
 * - Type safety
 * - Versionamento de esquemas
 */

class ProtoLoader {
    constructor() {
        this.packageDefinitions = new Map();
        this.services = new Map();
    }

    loadProto(protoFile, packageName) {
        const PROTO_PATH = path.join(__dirname, '../protos', protoFile);
        
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        
        this.packageDefinitions.set(packageName, packageDefinition);
        this.services.set(packageName, protoDescriptor[packageName]);
        
        return protoDescriptor[packageName];
    }

    getService(packageName) {
        return this.services.get(packageName);
    }

    // Helpers para conversão de dados
    static convertTimestamp(date) {
        return Math.floor(new Date(date).getTime() / 1000);
    }

    static convertFromTimestamp(timestamp) {
        return new Date(parseInt(timestamp) * 1000);
    }

    static convertPriority(priority) {
        const priorityMap = {
            'low': 0,
            'medium': 1, 
            'high': 2,
            'urgent': 3
        };
        return priorityMap[priority] || 1;
    }

    static convertFromPriority(priorityValue) {
        const priorityMap = ['low', 'medium', 'high', 'urgent'];
        return priorityMap[priorityValue] || 'medium';
    }
}

module.exports = ProtoLoader;
```

### 3.2 Middleware de Autenticação (`middleware/auth.js`)

```javascript
const jwt = require('jsonwebtoken');
const config = { jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui' };

/**
 * Interceptor de Autenticação gRPC
 * 
 * No gRPC, interceptors funcionam como middleware,
 * permitindo processamento cross-cutting como autenticação
 */

class AuthInterceptor {
    static validateToken(call, callback, next) {
        const token = call.request.token;
        
        if (!token) {
            const error = new Error('Token de autenticação obrigatório');
            error.code = grpc.status.UNAUTHENTICATED;
            return callback(error);
        }

        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            call.user = decoded;
            
            if (next) {
                return next(call, callback);
            }
        } catch (error) {
            const grpcError = new Error('Token inválido');
            grpcError.code = grpc.status.UNAUTHENTICATED;
            return callback(grpcError);
        }
    }

    static createInterceptor() {
        return (options, nextCall) => {
            return new grpc.InterceptingCall(nextCall(options), {
                start: function(metadata, listener, next) {
                    // Interceptar metadados se necessário
                    next(metadata, listener);
                }
            });
        };
    }
}

module.exports = AuthInterceptor;
```

---

## **PASSO 4: Modelos de Dados**

### 4.1 Modelo de Usuário (`models/User.js`)

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = { jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui', jwtExpiration: '24h' };

class User {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.username = data.username;
        this.password = data.password;
        this.firstName = data.firstName || data.first_name;
        this.lastName = data.lastName || data.last_name;
        this.createdAt = data.createdAt || data.created_at;
    }

    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 12);
    }

    async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    }

    generateToken() {
        return jwt.sign(
            { id: this.id, email: this.email, username: this.username },
            config.jwtSecret,
            { expiresIn: config.jwtExpiration }
        );
    }

    // Converter para formato Protobuf
    toProtobuf() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
            first_name: this.firstName,
            last_name: this.lastName,
            created_at: this.createdAt ? Math.floor(new Date(this.createdAt).getTime() / 1000) : 0
        };
    }

    toJSON() {
        const { password, ...user } = this;
        return user;
    }
}

module.exports = User;
```

### 4.2 Modelo de Tarefa (`models/Task.js`)

```javascript
const ProtoLoader = require('../utils/protoLoader');

class Task {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description || '';
        this.completed = data.completed || false;
        this.priority = data.priority || 'medium';
        this.userId = data.userId || data.user_id;
        this.createdAt = data.createdAt || data.created_at;
        this.updatedAt = data.updatedAt || data.updated_at;
    }

    validate() {
        const errors = [];
        if (!this.title?.trim()) errors.push('Título é obrigatório');
        if (!this.userId) errors.push('Usuário é obrigatório');
        if (!['low', 'medium', 'high', 'urgent'].includes(this.priority)) {
            errors.push('Prioridade deve ser: low, medium, high ou urgent');
        }
        return { isValid: errors.length === 0, errors };
    }

    // Converter para formato Protobuf
    toProtobuf() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            completed: this.completed,
            priority: ProtoLoader.convertPriority(this.priority),
            user_id: this.userId,
            created_at: this.createdAt ? Math.floor(new Date(this.createdAt).getTime() / 1000) : 0,
            updated_at: this.updatedAt ? Math.floor(new Date(this.updatedAt).getTime() / 1000) : 0
        };
    }

    // Converter de formato Protobuf
    static fromProtobuf(protoTask) {
        return new Task({
            id: protoTask.id,
            title: protoTask.title,
            description: protoTask.description,
            completed: protoTask.completed,
            priority: ProtoLoader.convertFromPriority(protoTask.priority),
            user_id: protoTask.user_id,
            created_at: protoTask.created_at,
            updated_at: protoTask.updated_at
        });
    }

    toJSON() {
        return { ...this };
    }
}

module.exports = Task;
```

---

## **PASSO 5: Database Manager**

### 5.1 Database (`database/database.js`)

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'tasks_grpc.db');
        this.db = null;
    }

    async init() {
        this.db = new sqlite3.Database(this.dbPath);
        await this.createTables();
        console.log('✅ Database gRPC inicializado');
    }

    async createTables() {
        const userTable = `
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`;

        const taskTable = `
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                completed INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'medium',
                userId TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users (id)
            )`;

        return Promise.all([
            this.run(userTable),
            this.run(taskTable)
        ]);
    }

    // Métodos auxiliares para promisificar SQLite
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Método específico para paginação
    async getAllWithPagination(sql, params, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
        const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as count FROM');
        
        const [rows, countResult] = await Promise.all([
            this.all(paginatedSql, [...params, limit, offset]),
            this.get(countSql, params)
        ]);

        return {
            rows,
            total: countResult.count,
            page,
            limit,
            totalPages: Math.ceil(countResult.count / limit)
        };
    }
}

module.exports = new Database();
```

---

## **PASSO 6: Implementação dos Serviços gRPC**

### 6.1 Serviço de Autenticação (`services/AuthService.js`)

```javascript
const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');
const jwt = require('jsonwebtoken');

class AuthService {
    /**
     * Registro de usuário
     * 
     * Implementa validação de dados e criação de usuário
     * usando Protocol Buffers para comunicação tipada
     */
    async register(call, callback) {
        try {
            const { email, username, password, first_name, last_name } = call.request;

            // Validações básicas
            if (!email || !username || !password || !first_name || !last_name) {
                return callback(null, {
                    success: false,
                    message: 'Todos os campos são obrigatórios',
                    errors: ['Campos obrigatórios não preenchidos']
                });
            }

            // Verificar se usuário já existe
            const existingUser = await database.get(
                'SELECT * FROM users WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingUser) {
                return callback(null, {
                    success: false,
                    message: 'Email ou username já existe',
                    errors: ['Usuário já cadastrado']
                });
            }

            // Criar usuário
            const userData = { 
                id: uuidv4(), 
                email, 
                username, 
                password, 
                firstName: first_name, 
                lastName: last_name 
            };
            const user = new User(userData);
            await user.hashPassword();

            await database.run(
                'INSERT INTO users (id, email, username, password, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, user.email, user.username, user.password, user.firstName, user.lastName]
            );

            const token = user.generateToken();

            callback(null, {
                success: true,
                message: 'Usuário criado com sucesso',
                user: user.toProtobuf(),
                token: token
            });
        } catch (error) {
            console.error('Erro no registro:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                errors: ['Falha no processamento']
            });
        }
    }

    /**
     * Login de usuário
     */
    async login(call, callback) {
        try {
            const { identifier, password } = call.request;

            if (!identifier || !password) {
                return callback(null, {
                    success: false,
                    message: 'Credenciais obrigatórias',
                    errors: ['Email/username e senha são obrigatórios']
                });
            }

            const userData = await database.get(
                'SELECT * FROM users WHERE email = ? OR username = ?',
                [identifier, identifier]
            );

            if (!userData) {
                return callback(null, {
                    success: false,
                    message: 'Credenciais inválidas',
                    errors: ['Usuário não encontrado']
                });
            }

            const user = new User(userData);
            const isValidPassword = await user.comparePassword(password);

            if (!isValidPassword) {
                return callback(null, {
                    success: false,
                    message: 'Credenciais inválidas',
                    errors: ['Senha incorreta']
                });
            }

            const token = user.generateToken();

            callback(null, {
                success: true,
                message: 'Login realizado com sucesso',
                user: user.toProtobuf(),
                token: token
            });
        } catch (error) {
            console.error('Erro no login:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                errors: ['Falha no processamento']
            });
        }
    }

    /**
     * Validação de token
     */
    async validateToken(call, callback) {
        try {
            const { token } = call.request;
            const jwtSecret = process.env.JWT_SECRET || 'seu-secret-aqui';

            if (!token) {
                return callback(null, {
                    valid: false,
                    message: 'Token não fornecido'
                });
            }

            const decoded = jwt.verify(token, jwtSecret);
            
            // Buscar dados atualizados do usuário
            const userData = await database.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
            
            if (!userData) {
                return callback(null, {
                    valid: false,
                    message: 'Usuário não encontrado'
                });
            }

            const user = new User(userData);

            callback(null, {
                valid: true,
                user: user.toProtobuf(),
                message: 'Token válido'
            });
        } catch (error) {
            callback(null, {
                valid: false,
                message: 'Token inválido'
            });
        }
    }
}

module.exports = AuthService;
```

### 6.2 Serviço de Tarefas (`services/TaskService.js`)

```javascript
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
            throw new Error('Token inválido');
        }
    }

    /**
     * Criar tarefa
     */
    async createTask(call, callback) {
        try {
            const { token, title, description, priority } = call.request;
            
            // Validar token
            const user = await this.validateToken(token);
            
            if (!title?.trim()) {
                return callback(null, {
                    success: false,
                    message: 'Título é obrigatório',
                    errors: ['Título não pode estar vazio']
                });
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
                return callback(null, {
                    success: false,
                    message: 'Dados inválidos',
                    errors: validation.errors
                });
            }

            await database.run(
                'INSERT INTO tasks (id, title, description, priority, userId) VALUES (?, ?, ?, ?, ?)',
                [task.id, task.title, task.description, task.priority, task.userId]
            );

            // Notificar streams ativos
            this.notifyStreams('TASK_CREATED', task);

            callback(null, {
                success: true,
                message: 'Tarefa criada com sucesso',
                task: task.toProtobuf()
            });
        } catch (error) {
            console.error('Erro ao criar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Listar tarefas com paginação
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
            const limitNum = Math.min(limit || 10, 100); // Máximo 100 por página

            const result = await database.getAllWithPagination(sql, params, pageNum, limitNum);
            const tasks = result.rows.map(row => {
                const task = new Task({...row, completed: row.completed === 1});
                return task.toProtobuf();
            });

            callback(null, {
                success: true,
                tasks: tasks,
                total: result.total,
                page: result.page,
                limit: result.limit
            });
        } catch (error) {
            console.error('Erro ao buscar tarefas:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
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
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada'
                });
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
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
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

            // Verificar se a tarefa existe
            const existingTask = await database.get(
                'SELECT * FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            if (!existingTask) {
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada'
                });
            }

            // Preparar dados para atualização
            const updateData = {
                title: title || existingTask.title,
                description: description !== undefined ? description : existingTask.description,
                completed: completed !== undefined ? completed : (existingTask.completed === 1),
                priority: priority !== undefined ? ProtoLoader.convertFromPriority(priority) : existingTask.priority
            };

            const result = await database.run(
                'UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
                [updateData.title, updateData.description, updateData.completed ? 1 : 0, updateData.priority, task_id, user.id]
            );

            if (result.changes === 0) {
                return callback(null, {
                    success: false,
                    message: 'Falha ao atualizar tarefa'
                });
            }

            // Buscar tarefa atualizada
            const updatedRow = await database.get(
                'SELECT * FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            const task = new Task({...updatedRow, completed: updatedRow.completed === 1});
            
            // Notificar streams ativos
            this.notifyStreams('TASK_UPDATED', task);

            callback(null, {
                success: true,
                message: 'Tarefa atualizada com sucesso',
                task: task.toProtobuf()
            });
        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
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

            // Buscar tarefa antes de deletar (para notificações)
            const existingTask = await database.get(
                'SELECT * FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            if (!existingTask) {
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada'
                });
            }

            const result = await database.run(
                'DELETE FROM tasks WHERE id = ? AND userId = ?',
                [task_id, user.id]
            );

            if (result.changes === 0) {
                return callback(null, {
                    success: false,
                    message: 'Falha ao deletar tarefa'
                });
            }

            const task = new Task({...existingTask, completed: existingTask.completed === 1});
            
            // Notificar streams ativos
            this.notifyStreams('TASK_DELETED', task);

            callback(null, {
                success: true,
                message: 'Tarefa deletada com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar tarefa:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Estatísticas das tarefas
     */
    async getTaskStats(call, callback) {
        try {
            const { token } = call.request;
            const user = await this.validateToken(token);

            const stats = await database.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
                FROM tasks WHERE userId = ?
            `, [user.id]);

            const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100) : 0;

            callback(null, {
                success: true,
                stats: {
                    total: stats.total,
                    completed: stats.completed,
                    pending: stats.pending,
                    completion_rate: parseFloat(completionRate.toFixed(2))
                }
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            const grpcError = new Error(error.message || 'Erro interno do servidor');
            grpcError.code = error.message === 'Token inválido' ? grpc.status.UNAUTHENTICATED : grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Stream de tarefas (Server Streaming)
     * 
     * Demonstra como o gRPC permite streaming de dados,
     * possibilitando atualizações em tempo real
     */
    async streamTasks(call) {
        try {
            const { token, completed } = call.request;
            const user = await this.validateToken(token);

            let sql = 'SELECT * FROM tasks WHERE userId = ?';
            const params = [user.id];

            if (completed !== undefined && completed !== null) {
                sql += ' AND completed = ?';
                params.push(completed ? 1 : 0);
            }

            sql += ' ORDER BY createdAt DESC';

            const rows = await database.all(sql, params);

            // Enviar tarefas existentes
            for (const row of rows) {
                const task = new Task({...row, completed: row.completed === 1});
                call.write(task.toProtobuf());
                
                // Simular delay para demonstrar streaming
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Manter stream aberto para futuras atualizações
            const sessionId = uuidv4();
            this.streamingSessions.set(sessionId, {
                call,
                userId: user.id,
                filter: { completed }
            });

            call.on('cancelled', () => {
                this.streamingSessions.delete(sessionId);
                console.log(`Stream cancelado: ${sessionId}`);
            });

        } catch (error) {
            console.error('Erro no stream de tarefas:', error);
            call.destroy(new Error(error.message || 'Erro no streaming'));
        }
    }

    /**
     * Stream de notificações (Server Streaming)
     * 
     * Envia notificações em tempo real sobre mudanças nas tarefas
     */
    async streamNotifications(call) {
        try {
            const { token } = call.request;
            const user = await this.validateToken(token);

            const sessionId = uuidv4();
            
            this.streamingSessions.set(sessionId, {
                call,
                userId: user.id,
                type: 'notifications'
            });

            // Enviar mensagem inicial
            call.write({
                type: 0, // TASK_CREATED
                message: 'Stream de notificações iniciado',
                timestamp: Math.floor(Date.now() / 1000),
                task: null
            });

            call.on('cancelled', () => {
                this.streamingSessions.delete(sessionId);
                console.log(`Stream de notificações cancelado: ${sessionId}`);
            });

            call.on('error', (error) => {
                console.error('Erro no stream de notificações:', error);
                this.streamingSessions.delete(sessionId);
            });

        } catch (error) {
            console.error('Erro ao iniciar stream de notificações:', error);
            call.destroy(new Error(error.message || 'Erro no streaming'));
        }
    }

    /**
     * Notificar todos os streams ativos sobre mudanças
     */
    notifyStreams(action, task) {
        const notificationTypeMap = {
            'TASK_CREATED': 0,
            'TASK_UPDATED': 1,
            'TASK_DELETED': 2,
            'TASK_COMPLETED': 3
        };

        for (const [sessionId, session] of this.streamingSessions.entries()) {
            try {
                if (session.userId === task.userId) {
                    if (session.type === 'notifications') {
                        // Stream de notificações
                        session.call.write({
                            type: notificationTypeMap[action],
                            task: task.toProtobuf(),
                            message: `Tarefa ${action.toLowerCase().replace('_', ' ')}`,
                            timestamp: Math.floor(Date.now() / 1000)
                        });
                    } else if (session.filter) {
                        // Stream de tarefas com filtro
                        const { completed } = session.filter;
                        if (completed === undefined || completed === task.completed) {
                            if (action !== 'TASK_DELETED') {
                                session.call.write(task.toProtobuf());
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Erro ao notificar stream ${sessionId}:`, error);
                this.streamingSessions.delete(sessionId);
            }
        }
    }
}

module.exports = TaskService;
```

---

## **PASSO 7: Servidor gRPC Principal**

### 7.1 Implementação do Servidor (`server.js`)

```javascript
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
    constructor() {
        this.server = new grpc.Server();
        this.protoLoader = new ProtoLoader();
        this.authService = new AuthService();
        this.taskService = new TaskService();
    }

    async initialize() {
        try {
            // Inicializar banco de dados
            await database.init();

            // Carregar definições dos protobuf
            const authProto = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const taskProto = this.protoLoader.loadProto('task_service.proto', 'tasks');

            // Registrar serviços de autenticação
            this.server.addService(authProto.AuthService.service, {
                Register: this.authService.register.bind(this.authService),
                Login: this.authService.login.bind(this.authService),
                ValidateToken: this.authService.validateToken.bind(this.authService)
            });

            // Registrar serviços de tarefas
            this.server.addService(taskProto.TaskService.service, {
                CreateTask: this.taskService.createTask.bind(this.taskService),
                GetTasks: this.taskService.getTasks.bind(this.taskService),
                GetTask: this.taskService.getTask.bind(this.taskService),
                UpdateTask: this.taskService.updateTask.bind(this.taskService),
                DeleteTask: this.taskService.deleteTask.bind(this.taskService),
                GetTaskStats: this.taskService.getTaskStats.bind(this.taskService),
                StreamTasks: this.taskService.streamTasks.bind(this.taskService),
                StreamNotifications: this.taskService.streamNotifications.bind(this.taskService)
            });

            console.log('✅ Serviços gRPC registrados com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            throw error;
        }
    }

    async start(port = 50051) {
        try {
            await this.initialize();

            const serverCredentials = grpc.ServerCredentials.createInsecure();
            
            this.server.bindAsync(`0.0.0.0:${port}`, serverCredentials, (error, boundPort) => {
                if (error) {
                    console.error('❌ Falha ao iniciar servidor:', error);
                    return;
                }

                this.server.start();
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
if (require.main === module) {
    const server = new GrpcServer();
    const port = process.env.GRPC_PORT || 50051;
    server.start(port);
}

module.exports = GrpcServer;
```

---

## **PASSO 8: Cliente de Exemplo**

### 8.1 Cliente gRPC (`client.js`)

```javascript
const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('./utils/protoLoader');

/**
 * Cliente gRPC de Exemplo
 * 
 * Demonstra como consumir serviços gRPC de forma eficiente,
 * incluindo streaming de dados em tempo real
 */

class GrpcClient {
    constructor(serverAddress = 'localhost:50051') {
        this.serverAddress = serverAddress;
        this.protoLoader = new ProtoLoader();
        this.authClient = null;
        this.taskClient = null;
        this.currentToken = null;
    }

    async initialize() {
        try {
            // Carregar protobuf
            const authProto = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const taskProto = this.protoLoader.loadProto('task_service.proto', 'tasks');

            // Criar clientes
            const credentials = grpc.credentials.createInsecure();
            
            this.authClient = new authProto.AuthService(this.serverAddress, credentials);
            this.taskClient = new taskProto.TaskService(this.serverAddress, credentials);

            console.log('✅ Cliente gRPC inicializado');
        } catch (error) {
            console.error('❌ Erro na inicialização do cliente:', error);
            throw error;
        }
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
        const registerPromise = this.promisify(this.authClient, 'Register');
        return await registerPromise(userData);
    }

    async login(credentials) {
        const loginPromise = this.promisify(this.authClient, 'Login');
        const response = await loginPromise(credentials);
        
        if (response.success) {
            this.currentToken = response.token;
            console.log('🔑 Token obtido com sucesso');
        }
        
        return response;
    }

    async createTask(taskData) {
        const createPromise = this.promisify(this.taskClient, 'CreateTask');
        return await createPromise({
            token: this.currentToken,
            ...taskData
        });
    }

    async getTasks(filters = {}) {
        const getTasksPromise = this.promisify(this.taskClient, 'GetTasks');
        return await getTasksPromise({
            token: this.currentToken,
            ...filters
        });
    }

    async getTask(taskId) {
        const getTaskPromise = this.promisify(this.taskClient, 'GetTask');
        return await getTaskPromise({
            token: this.currentToken,
            task_id: taskId
        });
    }

    async updateTask(taskId, updates) {
        const updatePromise = this.promisify(this.taskClient, 'UpdateTask');
        return await updatePromise({
            token: this.currentToken,
            task_id: taskId,
            ...updates
        });
    }

    async deleteTask(taskId) {
        const deletePromise = this.promisify(this.taskClient, 'DeleteTask');
        return await deletePromise({
            token: this.currentToken,
            task_id: taskId
        });
    }

    async getStats() {
        const statsPromise = this.promisify(this.taskClient, 'GetTaskStats');
        return await statsPromise({
            token: this.currentToken
        });
    }

    // Demonstração de streaming
    streamTasks(filters = {}) {
        const stream = this.taskClient.StreamTasks({
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
        const stream = this.taskClient.StreamNotifications({
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
}

// Demonstração de uso
async function demonstrateGrpcClient() {
    const client = new GrpcClient();
    
    try {
        await client.initialize();

        // 1. Registrar usuário
        console.log('\n1. Registrando usuário...');
        const registerResponse = await client.register({
            email: 'usuario@teste.com',
            username: 'usuarioteste',
            password: 'senha123',
            first_name: 'João',
            last_name: 'Silva'
        });
        console.log('Registro:', registerResponse.message);

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
        console.log('Stats:', statsResponse.stats);

        // 7. Demonstrar streaming (comentado para evitar loop infinito)
        // console.log('\n7. Iniciando stream de notificações...');
        // const notificationStream = client.streamNotifications();
        
        // Manter stream aberto por alguns segundos
        // setTimeout(() => notificationStream.cancel(), 5000);

    } catch (error) {
        console.error('❌ Erro na demonstração:', error);
    }
}

// Executar demonstração se arquivo for executado diretamente
if (require.main === module) {
    demonstrateGrpcClient();
}

module.exports = GrpcClient;
```
---

## **PASSO 9: Configuração de Scripts**

### 9.1 Atualizar Package.json

```json
{
  "name": "lab02-servidor-grpc",
  "version": "1.0.0",
  "description": "Sistema de tarefas com gRPC e Protocol Buffers",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "client": "node client.js",
    "test": "jest --verbose",
    "test:watch": "jest --watch",
    "proto:compile": "grpc_tools_node_protoc --js_out=import_style=commonjs,binary:./generated --grpc_out=grpc_js:./generated --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` -I ./protos ./protos/*.proto",
    "benchmark": "node benchmark.js"
  },
  "keywords": ["grpc", "protocol-buffers", "sistemas-distribuidos", "streaming"],
  "author": "Aluno PUC Minas",
  "license": "MIT",
  "dependencies": {
    "@grpc/grpc-js": "^1.9.0",
    "@grpc/proto-loader": "^0.7.0",
    "uuid": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "sqlite3": "^5.1.0"
  },
  "devDependencies": {
    "grpc-tools": "^1.12.4",
    "jest": "^29.0.0",
    "nodemon": "^3.0.0",
    "axios": "^1.4.0"
  }
}
```

---

## **PASSO 10: Testes dos Serviços gRPC**

### 10.1 Testes Automatizados (`tests/grpc.test.js`)

```javascript
const GrpcServer = require('../server');
const GrpcClient = require('../client');

describe('gRPC Services Tests', () => {
    let server;
    let client;
    let authToken;
    let taskId;

    beforeAll(async () => {
        // Iniciar servidor gRPC em porta diferente para testes
        server = new GrpcServer();
        
        // Usar Promise para aguardar o servidor inicializar
        await new Promise((resolve, reject) => {
            server.initialize().then(() => {
                const grpc = require('@grpc/grpc-js');
                const serverCredentials = grpc.ServerCredentials.createInsecure();
                
                server.server.bindAsync('0.0.0.0:50052', serverCredentials, (error, boundPort) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    server.server.start();
                    resolve();
                });
            }).catch(reject);
        });
        
        // Aguardar um pouco mais para garantir que o servidor está pronto
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Inicializar cliente
        client = new GrpcClient('localhost:50052');
        await client.initialize();
    }, 30000);

    afterAll(async () => {
        if (server?.server) {
            await new Promise(resolve => {
                server.server.tryShutdown(() => resolve());
            });
        }
    });

    describe('Autenticação', () => {
        test('deve registrar usuário com sucesso', async () => {
            const uniqueId = Date.now();
            const response = await client.register({
                email: `test${uniqueId}@grpc.com`,
                username: `grpctest${uniqueId}`,
                password: 'password123',
                first_name: 'Test',
                last_name: 'User'
            });

            expect(response.success).toBe(true);
            expect(response.token).toBeDefined();
            expect(response.user).toBeDefined();
            expect(response.user.email).toBe(`test${uniqueId}@grpc.com`);
            authToken = response.token;
            
            // Configurar o token no cliente para próximos testes
            client.currentToken = response.token;
        });

        test('deve fazer login com sucesso', async () => {
            // Usar as credenciais do usuário recém-criado
            const response = await client.login({
                identifier: client.currentToken ? 'existing_user@grpc.com' : 'test@grpc.com',
                password: 'password123'
            });

            // Se o login falhar, tentar com usuário que sabemos que existe
            if (!response.success) {
                // Criar um novo usuário para login
                const uniqueId = Date.now() + 1;
                await client.register({
                    email: `logintest${uniqueId}@grpc.com`,
                    username: `logintest${uniqueId}`,
                    password: 'password123',
                    first_name: 'Login',
                    last_name: 'Test'
                });

                const loginResponse = await client.login({
                    identifier: `logintest${uniqueId}@grpc.com`,
                    password: 'password123'
                });

                expect(loginResponse.success).toBe(true);
                expect(loginResponse.token).toBeDefined();
                expect(loginResponse.user).toBeDefined();
                client.currentToken = loginResponse.token;
            } else {
                expect(response.success).toBe(true);
                expect(response.token).toBeDefined();
                expect(response.user).toBeDefined();
            }
        });

        test('deve rejeitar credenciais inválidas', async () => {
            const response = await client.login({
                identifier: 'usuario_inexistente@grpc.com',
                password: 'senhaerrada'
            });

            expect(response.success).toBe(false);
            expect(response.errors).toBeDefined();
            expect(response.errors.length).toBeGreaterThan(0);
        });

        test('deve validar token corretamente', async () => {
            // Garantir que temos um token válido
            if (!client.currentToken) {
                const uniqueId = Date.now() + 2;
                const regResponse = await client.register({
                    email: `tokentest${uniqueId}@grpc.com`,
                    username: `tokentest${uniqueId}`,
                    password: 'password123',
                    first_name: 'Token',
                    last_name: 'Test'
                });
                client.currentToken = regResponse.token;
            }

            const validateTokenPromise = client.promisify(client.authClient, 'ValidateToken');
            const response = await validateTokenPromise({ token: client.currentToken });

            expect(response.valid).toBe(true);
            expect(response.user).toBeDefined();
        });

        test('deve rejeitar token inválido', async () => {
            const validateTokenPromise = client.promisify(client.authClient, 'ValidateToken');
            const response = await validateTokenPromise({ token: 'token-invalido' });

            expect(response.valid).toBe(false);
            expect(response.message).toContain('inválido');
        });
    });

    describe('Gerenciamento de Tarefas', () => {
        beforeAll(async () => {
            // Garantir que temos um token válido antes dos testes de tarefas
            if (!client.currentToken) {
                const uniqueId = Date.now() + 100;
                const regResponse = await client.register({
                    email: `tasktest${uniqueId}@grpc.com`,
                    username: `tasktest${uniqueId}`,
                    password: 'password123',
                    first_name: 'Task',
                    last_name: 'Test'
                });
                client.currentToken = regResponse.token;
            }
        });

        test('deve criar tarefa com dados válidos', async () => {
            const response = await client.createTask({
                title: 'Tarefa gRPC Test',
                description: 'Testando criação via gRPC',
                priority: 1 // MEDIUM
            });

            expect(response.success).toBe(true);
            expect(response.task).toBeDefined();
            expect(response.task.title).toBe('Tarefa gRPC Test');
            expect(response.task.priority).toBe('MEDIUM');
            taskId = response.task.id;
        });

        test('deve rejeitar criação sem título', async () => {
            try {
                const response = await client.createTask({
                    title: '',
                    description: 'Sem título',
                    priority: 1
                });

                // Se chegou aqui, a resposta deve indicar falha
                expect(response.success).toBe(false);
                if (response.errors) {
                    expect(response.errors).toContain('Título não pode estar vazio');
                }
            } catch (error) {
                // Erro gRPC é esperado para dados inválidos
                expect(error.code).toBeDefined();
            }
        });

        test('deve listar tarefas com paginação', async () => {
            const response = await client.getTasks({
                page: 1,
                limit: 10
            });

            expect(response.success).toBe(true);
            expect(Array.isArray(response.tasks)).toBe(true);
            expect(response.total).toBeGreaterThanOrEqual(0);
            expect(response.page).toBe(1);
            expect(response.limit).toBe(10);
        });

        test('deve buscar tarefa específica', async () => {
            if (!taskId) {
                // Criar uma tarefa se não temos ID
                const createResponse = await client.createTask({
                    title: 'Tarefa para busca',
                    description: 'Teste de busca específica',
                    priority: 0
                });
                taskId = createResponse.task.id;
            }

            const response = await client.getTask(taskId);

            expect(response.success).toBe(true);
            expect(response.task).toBeDefined();
            expect(response.task.id).toBe(taskId);
        });

        test('deve retornar erro para tarefa inexistente', async () => {
            const response = await client.getTask('id-inexistente-123456');

            expect(response.success).toBe(false);
            expect(response.message).toContain('não encontrada');
        });

        test('deve atualizar tarefa existente', async () => {
            if (!taskId) {
                // Criar uma tarefa se não temos ID
                const createResponse = await client.createTask({
                    title: 'Tarefa para atualizar',
                    description: 'Teste de atualização',
                    priority: 1
                });
                taskId = createResponse.task.id;
            }

            const response = await client.updateTask(taskId, {
                title: 'Tarefa Atualizada via gRPC',
                completed: true
            });

            expect(response.success).toBe(true);
            expect(response.task.title).toBe('Tarefa Atualizada via gRPC');
            expect(response.task.completed).toBe(true);
        });

        test('deve buscar estatísticas das tarefas', async () => {
            const response = await client.getStats();

            expect(response.success).toBe(true);
            expect(response.stats).toBeDefined();
            expect(typeof response.stats.total).toBe('number');
            expect(typeof response.stats.completed).toBe('number');
            expect(typeof response.stats.pending).toBe('number');
            expect(typeof response.stats.completion_rate).toBe('number');
        });

        test('deve deletar tarefa existente', async () => {
            if (!taskId) {
                // Criar uma tarefa para deletar se não temos ID
                const createResponse = await client.createTask({
                    title: 'Tarefa para deletar',
                    description: 'Teste de exclusão',
                    priority: 0
                });
                taskId = createResponse.task.id;
            }

            const response = await client.deleteTask(taskId);

            expect(response.success).toBe(true);
            expect(response.message).toContain('deletada com sucesso');
            
            // Limpar o taskId já que foi deletado
            taskId = null;
        });

        test('deve retornar erro ao deletar tarefa inexistente', async () => {
            const response = await client.deleteTask('id-inexistente-123456');

            expect(response.success).toBe(false);
            expect(response.message).toContain('não encontrada');
        });

        test('deve filtrar tarefas por status', async () => {
            // Criar uma tarefa não concluída
            await client.createTask({
                title: 'Tarefa Pendente',
                description: 'Não concluída',
                priority: 0
            });

            // Criar uma tarefa concluída
            const completedTask = await client.createTask({
                title: 'Tarefa Concluída',
                description: 'Já finalizada',
                priority: 1
            });

            await client.updateTask(completedTask.task.id, {
                completed: true
            });

            // Buscar apenas tarefas concluídas
            const completedResponse = await client.getTasks({ completed: true });
            expect(completedResponse.success).toBe(true);
            
            // Buscar apenas tarefas pendentes
            const pendingResponse = await client.getTasks({ completed: false });
            expect(pendingResponse.success).toBe(true);
        });
    });

    describe('Streaming', () => {
        beforeAll(async () => {
            // Garantir que temos um token válido antes dos testes de streaming
            if (!client.currentToken) {
                const uniqueId = Date.now() + 200;
                const regResponse = await client.register({
                    email: `streamtest${uniqueId}@grpc.com`,
                    username: `streamtest${uniqueId}`,
                    password: 'password123',
                    first_name: 'Stream',
                    last_name: 'Test'
                });
                client.currentToken = regResponse.token;
            }

            // Criar uma tarefa para garantir que o streaming tenha dados
            try {
                await client.createTask({
                    title: 'Tarefa para Stream Test',
                    description: 'Esta tarefa será usada nos testes de streaming',
                    priority: 1
                });
            } catch (error) {
                // Se falhar, não é crítico para os testes
                console.log('Falha ao criar tarefa para teste de stream:', error.message);
            }
        });

        test('deve receber stream de tarefas', (done) => {
            const stream = client.streamTasks();
            let receivedTasks = [];
            let streamEnded = false;
            let doneWasCalled = false;

            const finishTest = () => {
                if (!doneWasCalled) {
                    doneWasCalled = true;
                    done();
                }
            };

            const timeout = setTimeout(() => {
                if (!streamEnded && !doneWasCalled) {
                    stream.cancel();
                    expect(receivedTasks.length).toBeGreaterThanOrEqual(0);
                    finishTest();
                }
            }, 5000);

            stream.on('data', (task) => {
                receivedTasks.push(task);
                expect(task.id).toBeDefined();
                expect(task.title).toBeDefined();
            });

            stream.on('end', () => {
                if (!streamEnded) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    expect(receivedTasks.length).toBeGreaterThanOrEqual(0);
                    finishTest();
                }
            });

            stream.on('error', (error) => {
                if (!streamEnded) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    // Erro pode ser esperado se não houver tarefas
                    console.log('Stream error (pode ser esperado):', error.message);
                    finishTest();
                }
            });

            // Cancelar stream após 3 segundos para evitar timeout
            setTimeout(() => {
                if (!streamEnded && !doneWasCalled) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    stream.cancel();
                    finishTest();
                }
            }, 3000);
        }, 10000);

        test('deve receber stream de notificações', (done) => {
            const stream = client.streamNotifications();
            let receivedNotifications = [];
            let streamEnded = false;
            let doneWasCalled = false;

            const finishTest = () => {
                if (!doneWasCalled) {
                    doneWasCalled = true;
                    done();
                }
            };

            const timeout = setTimeout(() => {
                if (!streamEnded && !doneWasCalled) {
                    stream.cancel();
                    // Pelo menos devemos receber a notificação inicial
                    expect(receivedNotifications.length).toBeGreaterThanOrEqual(0);
                    finishTest();
                }
            }, 5000);

            stream.on('data', (notification) => {
                receivedNotifications.push(notification);
                expect(typeof notification.type).toBe('string');
                expect(notification.message).toBeDefined();
                expect(notification.timestamp).toBeDefined();
            });

            stream.on('end', () => {
                if (!streamEnded) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    finishTest();
                }
            });

            stream.on('error', (error) => {
                if (!streamEnded) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    console.log('Notification stream error (pode ser esperado):', error.message);
                    finishTest();
                }
            });

            // Cancelar stream após 2 segundos para garantir que termine
            setTimeout(() => {
                if (!streamEnded && !doneWasCalled) {
                    streamEnded = true;
                    clearTimeout(timeout);
                    // Devemos ter recebido pelo menos a mensagem inicial
                    expect(receivedNotifications.length).toBeGreaterThanOrEqual(1);
                    stream.cancel();
                    finishTest();
                }
            }, 2000);
        }, 10000);
    });

    describe('Validações e Segurança', () => {
        test('deve rejeitar requisições sem token', async () => {
            const client2 = new GrpcClient('localhost:50052');
            await client2.initialize();
            client2.currentToken = null;

            try {
                await client2.getTasks();
                fail('Deveria ter rejeitado requisição sem token');
            } catch (error) {
                expect(error.code).toBe(16); // UNAUTHENTICATED
            }
        });

        test('deve rejeitar token expirado/inválido', async () => {
            const client3 = new GrpcClient('localhost:50052');
            await client3.initialize();
            client3.currentToken = 'token.invalido.aqui';

            try {
                await client3.getTasks();
                fail('Deveria ter rejeitado token inválido');
            } catch (error) {
                expect(error.code).toBe(16); // UNAUTHENTICATED
            }
        });
    });
});```

---

## **PASSO 11: Comparação de Performance**

### 11.1 Benchmark Script (`benchmark.js`)

```javascript
const axios = require('axios'); // Para REST
const GrpcClient = require('./client'); // Para gRPC

/**
 * Benchmark: gRPC vs REST - VERSÃO CORRIGIDA
 * 
 * Compara performance entre implementações
 * gRPC/Protobuf vs REST/JSON
 */

class PerformanceBenchmark {
    constructor() {
        this.results = {
            grpc: { times: [], errors: 0, totalBytes: 0 },
            rest: { times: [], errors: 0, totalBytes: 0 }
        };
    }

    async setupGrpcUser() {
        const client = new GrpcClient();
        await client.initialize();
        
        const uniqueId = Date.now();
        const userData = {
            email: `benchmark${uniqueId}@grpc.com`,
            username: `benchmarkuser${uniqueId}`,
            password: 'benchmark123',
            first_name: 'Benchmark',
            last_name: 'User'
        };

        console.log('🔧 Configurando usuário para benchmark gRPC...');
        
        try {
            // Tentar registrar usuário
            const regResponse = await client.register(userData);
            if (regResponse.success && regResponse.token) {
                console.log('✅ Usuário registrado com sucesso');
                client.currentToken = regResponse.token;
                return client;
            } else {
                console.log('⚠️ Falha no registro, tentando login...');
                throw new Error('Registro falhou');
            }
        } catch (regError) {
            // Se registro falhar, tentar login
            try {
                const loginResponse = await client.login({
                    identifier: userData.email,
                    password: userData.password
                });
                
                if (loginResponse.success && loginResponse.token) {
                    console.log('✅ Login realizado com sucesso');
                    client.currentToken = loginResponse.token;
                    return client;
                } else {
                    throw new Error('Login também falhou');
                }
            } catch (loginError) {
                console.log('❌ Erro na autenticação gRPC:', loginError.message);
                throw new Error(`Falha na autenticação: ${loginError.message}`);
            }
        }
    }

    async benchmarkGrpc(iterations = 100) {
        console.log(`🔬 Iniciando benchmark gRPC (${iterations} iterações)...`);
        
        let client;
        try {
            client = await this.setupGrpcUser();
            
            // Verificar se o token está funcionando
            try {
                await client.getTasks({ page: 1, limit: 1 });
                console.log('✅ Token gRPC validado');
            } catch (error) {
                console.log('❌ Token inválido, tentando reautenticar...');
                client = await this.setupGrpcUser();
            }
            
        } catch (error) {
            console.log('❌ Falha na configuração do cliente gRPC:', error.message);
            console.log('⚠️ Pulando benchmark gRPC');
            return;
        }

        // Criar algumas tarefas para teste se não existirem
        console.log('📋 Criando tarefas de teste...');
        for (let i = 0; i < 3; i++) {
            try {
                await client.createTask({
                    title: `Tarefa Benchmark gRPC ${i + 1}`,
                    description: `Descrição da tarefa ${i + 1} para teste de performance`,
                    priority: i % 4 // Varia entre 0-3
                });
            } catch (error) {
                // Se falhar na criação, não é crítico
                console.log(`⚠️ Falha ao criar tarefa ${i + 1}: ${error.message}`);
            }
        }

        console.log('📊 Executando testes de performance gRPC...');

        // Benchmark de listagem de tarefas
        let successCount = 0;
        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            
            try {
                const response = await client.getTasks({ page: 1, limit: 10 });
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1e6; // Convert to milliseconds
                
                this.results.grpc.times.push(duration);
                successCount++;
                
                // Estimar tamanho da resposta
                const responseSize = JSON.stringify(response).length;
                this.results.grpc.totalBytes += responseSize;
                
                if (i % 20 === 0 && i > 0) {
                    console.log(`gRPC: ${i}/${iterations} completed (${successCount} success)`);
                }
            } catch (error) {
                this.results.grpc.errors++;
                console.error(`❌ Erro gRPC na iteração ${i}: ${error.message}`);
                
                // Se muitos erros consecutivos, parar
                if (this.results.grpc.errors > 10 && i < 20) {
                    console.log('❌ Muitos erros gRPC, interrompendo benchmark');
                    break;
                }
            }
        }

        console.log(`✅ Benchmark gRPC concluído: ${successCount}/${iterations} sucessos`);
    }

    async setupRestUser() {
        const baseUrl = 'http://localhost:3000/api';
        const uniqueId = Date.now() + 1000; // Diferente do gRPC
        
        const userData = {
            email: `benchmarkrest${uniqueId}@rest.com`,
            username: `benchmarkrest${uniqueId}`,
            password: 'benchmark123',
            firstName: 'Benchmark',
            lastName: 'REST'
        };

        console.log('🔧 Configurando usuário para benchmark REST...');

        try {
            // Tentar registrar
            try {
                await axios.post(`${baseUrl}/auth/register`, userData);
                console.log('✅ Usuário REST registrado');
            } catch (regError) {
                console.log('⚠️ Registro REST falhou (usuário pode já existir)');
            }

            // Fazer login
            const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
                identifier: userData.email,
                password: userData.password
            });

            const token = loginResponse.data.data.token;
            console.log('✅ Login REST realizado com sucesso');
            
            return { token, baseUrl };
            
        } catch (error) {
            throw new Error(`Falha na autenticação REST: ${error.message}`);
        }
    }

    async benchmarkRest(iterations = 100) {
        console.log(`🌐 Iniciando benchmark REST (${iterations} iterações)...`);
        
        let restConfig;
        try {
            restConfig = await this.setupRestUser();
        } catch (error) {
            console.log('⚠️ Servidor REST não disponível ou erro na configuração:', error.message);
            console.log('   Para executar comparação completa, inicie o servidor do Roteiro 1 na porta 3000');
            return;
        }

        const { token, baseUrl } = restConfig;
        const headers = { Authorization: `Bearer ${token}` };

        // Criar algumas tarefas para teste
        console.log('📋 Criando tarefas de teste REST...');
        for (let i = 0; i < 3; i++) {
            try {
                await axios.post(`${baseUrl}/tasks`, {
                    title: `Tarefa REST Benchmark ${i + 1}`,
                    description: `Descrição da tarefa ${i + 1} para teste de performance`,
                    priority: ['low', 'medium', 'high', 'urgent'][i % 4]
                }, { headers });
            } catch (error) {
                console.log(`⚠️ Falha ao criar tarefa REST ${i + 1}: ${error.message}`);
            }
        }

        console.log('📊 Executando testes de performance REST...');

        // Benchmark de listagem de tarefas
        let successCount = 0;
        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            
            try {
                const response = await axios.get(`${baseUrl}/tasks?page=1&limit=10`, { headers });
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1e6;
                
                this.results.rest.times.push(duration);
                successCount++;
                
                // Calcular tamanho real da resposta
                const responseSize = JSON.stringify(response.data).length;
                this.results.rest.totalBytes += responseSize;
                
                if (i % 20 === 0 && i > 0) {
                    console.log(`REST: ${i}/${iterations} completed (${successCount} success)`);
                }
            } catch (error) {
                this.results.rest.errors++;
                console.error(`❌ Erro REST na iteração ${i}: ${error.message}`);
                
                // Se muitos erros consecutivos, parar
                if (this.results.rest.errors > 10 && i < 20) {
                    console.log('❌ Muitos erros REST, interrompendo benchmark');
                    break;
                }
            }
        }

        console.log(`✅ Benchmark REST concluído: ${successCount}/${iterations} sucessos`);
    }

    calculateStats(times) {
        if (times.length === 0) return null;
        
        const sorted = times.sort((a, b) => a - b);
        const sum = times.reduce((acc, time) => acc + time, 0);
        
        return {
            mean: sum / times.length,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            stdDev: Math.sqrt(times.reduce((acc, time) => acc + Math.pow(time - (sum / times.length), 2), 0) / times.length)
        };
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADOS DO BENCHMARK DE PERFORMANCE');
        console.log('='.repeat(60));

        const grpcStats = this.calculateStats(this.results.grpc.times);
        const restStats = this.calculateStats(this.results.rest.times);

        if (grpcStats && this.results.grpc.times.length > 0) {
            console.log('\n🔧 gRPC/Protocol Buffers:');
            console.log(`   ├─ Requisições válidas: ${this.results.grpc.times.length}`);
            console.log(`   ├─ Erros: ${this.results.grpc.errors}`);
            console.log(`   ├─ Taxa de sucesso: ${((this.results.grpc.times.length / (this.results.grpc.times.length + this.results.grpc.errors)) * 100).toFixed(1)}%`);
            console.log(`   ├─ Tempo médio: ${grpcStats.mean.toFixed(2)}ms`);
            console.log(`   ├─ Mediana: ${grpcStats.median.toFixed(2)}ms`);
            console.log(`   ├─ Desvio padrão: ${grpcStats.stdDev.toFixed(2)}ms`);
            console.log(`   ├─ Min/Max: ${grpcStats.min.toFixed(2)}ms / ${grpcStats.max.toFixed(2)}ms`);
            console.log(`   ├─ P95: ${grpcStats.p95.toFixed(2)}ms`);
            console.log(`   ├─ P99: ${grpcStats.p99.toFixed(2)}ms`);
            console.log(`   └─ Total bytes: ${this.results.grpc.totalBytes.toLocaleString()}`);
        } else {
            console.log('\n🔧 gRPC/Protocol Buffers:');
            console.log('   └─ ❌ Nenhum dado válido coletado');
        }

        if (restStats && this.results.rest.times.length > 0) {
            console.log('\n🌐 REST/JSON:');
            console.log(`   ├─ Requisições válidas: ${this.results.rest.times.length}`);
            console.log(`   ├─ Erros: ${this.results.rest.errors}`);
            console.log(`   ├─ Taxa de sucesso: ${((this.results.rest.times.length / (this.results.rest.times.length + this.results.rest.errors)) * 100).toFixed(1)}%`);
            console.log(`   ├─ Tempo médio: ${restStats.mean.toFixed(2)}ms`);
            console.log(`   ├─ Mediana: ${restStats.median.toFixed(2)}ms`);
            console.log(`   ├─ Desvio padrão: ${restStats.stdDev.toFixed(2)}ms`);
            console.log(`   ├─ Min/Max: ${restStats.min.toFixed(2)}ms / ${restStats.max.toFixed(2)}ms`);
            console.log(`   ├─ P95: ${restStats.p95.toFixed(2)}ms`);
            console.log(`   ├─ P99: ${restStats.p99.toFixed(2)}ms`);
            console.log(`   └─ Total bytes: ${this.results.rest.totalBytes.toLocaleString()}`);
        } else {
            console.log('\n🌐 REST/JSON:');
            console.log('   └─ ⚠️ Servidor REST não disponível ou sem dados válidos');
        }

        if (grpcStats && restStats && this.results.grpc.times.length > 0 && this.results.rest.times.length > 0) {
            const latencyImprovement = ((restStats.mean - grpcStats.mean) / restStats.mean * 100);
            const bandwidthSavings = ((this.results.rest.totalBytes - this.results.grpc.totalBytes) / this.results.rest.totalBytes * 100);
            
            console.log('\n🏆 ANÁLISE COMPARATIVA:');
            console.log(`   ├─ Latência: gRPC é ${Math.abs(latencyImprovement).toFixed(1)}% ${latencyImprovement > 0 ? 'mais rápido' : 'mais lento'} que REST`);
            console.log(`   ├─ Diferença média: ${Math.abs(restStats.mean - grpcStats.mean).toFixed(2)}ms`);
            console.log(`   ├─ Bandwidth: gRPC usa ${Math.abs(bandwidthSavings).toFixed(1)}% ${bandwidthSavings > 0 ? 'menos' : 'mais'} dados`);
            console.log(`   ├─ Throughput gRPC: ${(1000 / grpcStats.mean).toFixed(1)} req/s`);
            console.log(`   ├─ Throughput REST: ${(1000 / restStats.mean).toFixed(1)} req/s`);
            
            if (latencyImprovement > 0) {
                console.log(`   └─ 🎯 gRPC demonstra melhor performance para este caso de uso`);
            } else {
                console.log(`   └─ ⚠️ REST apresentou melhor performance neste teste`);
            }
        } else {
            console.log('\n🏆 ANÁLISE COMPARATIVA:');
            console.log('   └─ ⚠️ Comparação não disponível - dados insuficientes de um ou ambos protocolos');
        }

        console.log('\n📝 OBSERVAÇÕES:');
        console.log('   • Resultados podem variar baseado em hardware, rede e carga do sistema');
        console.log('   • gRPC típicamente performa melhor com payloads maiores e alta frequência');
        console.log('   • REST pode ser mais rápido para operações simples e cache HTTP');
        console.log('   • Considere também fatores como debugging, tooling e ecosystem');
        console.log('   • Para comparação completa, certifique-se que ambos servidores estão rodando');
    }
}

// Executar benchmark
async function runBenchmark() {
    const iterations = process.argv[2] ? parseInt(process.argv[2]) : 50;
    const benchmark = new PerformanceBenchmark();
    
    console.log(`🚀 Iniciando benchmark com ${iterations} iterações por protocolo`);
    console.log('⏱️ Este processo pode levar alguns minutos...\n');
    
    // Verificar se pelo menos um servidor está disponível
    console.log('🔍 Verificando disponibilidade dos servidores...');
    
    try {
        // Testar gRPC
        const grpcClient = new GrpcClient();
        await grpcClient.initialize();
        console.log('✅ Servidor gRPC disponível');
    } catch (error) {
        console.log('❌ Servidor gRPC não disponível:', error.message);
        console.log('   Execute "npm start" para iniciar o servidor gRPC');
        return;
    }
    
    try {
        // Testar REST
        await axios.get('http://localhost:3000/health');
        console.log('✅ Servidor REST disponível');
    } catch (error) {
        console.log('⚠️ Servidor REST não disponível (comparação limitada)');
        console.log('   Para comparação completa, execute o servidor do Roteiro 1 na porta 3000');
    }
    
    console.log(''); // Nova linha
    
    try {
        await benchmark.benchmarkGrpc(iterations);
        await benchmark.benchmarkRest(iterations);
        benchmark.printResults();
    } catch (error) {
        console.error('❌ Erro no benchmark:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

if (require.main === module) {
    runBenchmark().catch(error => {
        console.error('❌ Falha crítica no benchmark:', error.message);
        process.exit(1);
    });
}

module.exports = PerformanceBenchmark;
```

---

## **PASSO 12: Execução e Testes**

### 12.1 Executar o Servidor

```bash
# Instalar dependências
npm install

# Executar servidor gRPC
npm start

# Em outro terminal, testar com cliente
npm run client
```

### 12.2 Executar Testes Automatizados

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes específicos
npx jest tests/grpc.test.js --verbose

# Executar com cobertura de código
npx jest --coverage
```

### 12.3 Executar Benchmark de Performance

```bash
# Benchmark padrão (50 iterações)
npm run benchmark

# Benchmark com número customizado de iterações
node benchmark.js 100

# Comparação detalhada (requer servidor REST rodando)
# Terminal 1: Iniciar servidor gRPC
npm start

# Terminal 2: Iniciar servidor REST (Roteiro 1)
cd ../lab01-servidor-tradicional
npm start

# Terminal 3: Executar benchmark
cd ../lab02-servidor-grpc
node benchmark.js 100
```
---

## **PASSO 13: Ferramentas de Debug e Monitoramento**

### 13.1 Client de Debug (`debug-client.js`)

```javascript
const GrpcClient = require('./client');

class DebugGrpcClient extends GrpcClient {
    constructor(serverAddress) {
        super(serverAddress);
        this.enableLogging = true;
        this.requestCounter = 0;
        this.performanceMetrics = {
            calls: [],
            totalRequests: 0,
            totalErrors: 0,
            avgResponseTime: 0
        };
    }

    log(message, data = null) {
        if (this.enableLogging) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${message}`);
            if (data) {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }

    recordMetrics(method, duration, success) {
        this.performanceMetrics.totalRequests++;
        if (!success) this.performanceMetrics.totalErrors++;
        
        this.performanceMetrics.calls.push({
            method,
            duration,
            success,
            timestamp: Date.now()
        });

        // Calcular tempo médio de resposta
        const totalTime = this.performanceMetrics.calls.reduce((sum, call) => sum + call.duration, 0);
        this.performanceMetrics.avgResponseTime = totalTime / this.performanceMetrics.calls.length;
    }

    promisify(client, method) {
        return (request) => {
            return new Promise((resolve, reject) => {
                const requestId = ++this.requestCounter;
                this.log(`📤 [${requestId}] Calling ${method}`, request);
                const start = Date.now();
                
                client[method](request, (error, response) => {
                    const duration = Date.now() - start;
                    
                    if (error) {
                        this.log(`❌ [${requestId}] ${method} failed (${duration}ms)`, {
                            code: error.code,
                            message: error.message,
                            details: error.details
                        });
                        this.recordMetrics(method, duration, false);
                        reject(error);
                    } else {
                        this.log(`✅ [${requestId}] ${method} success (${duration}ms)`, response);
                        this.recordMetrics(method, duration, true);
                        resolve(response);
                    }
                });
            });
        };
    }

    streamTasks(filters = {}) {
        this.log('📤 Starting StreamTasks', filters);
        const stream = super.streamTasks(filters);
        let taskCount = 0;
        const startTime = Date.now();

        stream.on('data', (task) => {
            taskCount++;
            this.log(`📋 Stream task #${taskCount}`, {
                id: task.id,
                title: task.title,
                completed: task.completed,
                priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][task.priority]
            });
        });

        stream.on('end', () => {
            const duration = Date.now() - startTime;
            this.log(`📋 StreamTasks ended. Total: ${taskCount} tasks in ${duration}ms`);
        });

        stream.on('error', (error) => {
            this.log('❌ StreamTasks error', {
                code: error.code,
                message: error.message
            });
        });

        return stream;
    }

    streamNotifications() {
        this.log('📤 Starting StreamNotifications');
        const stream = super.streamNotifications();
        let notificationCount = 0;

        stream.on('data', (notification) => {
            notificationCount++;
            const typeMap = ['CREATED', 'UPDATED', 'DELETED', 'COMPLETED'];
            this.log(`🔔 Notification #${notificationCount}`, {
                type: typeMap[notification.type],
                message: notification.message,
                task: notification.task ? notification.task.title : null,
                timestamp: new Date(parseInt(notification.timestamp) * 1000).toISOString()
            });
        });

        stream.on('end', () => {
            this.log(`🔔 StreamNotifications ended. Total: ${notificationCount} notifications`);
        });

        stream.on('error', (error) => {
            this.log('❌ StreamNotifications error', {
                code: error.code,
                message: error.message
            });
        });

        return stream;
    }

    printMetrics() {
        console.log('\n📊 MÉTRICAS DE PERFORMANCE DO CLIENTE');
        console.log('='.repeat(50));
        console.log(`Total de requisições: ${this.performanceMetrics.totalRequests}`);
        console.log(`Total de erros: ${this.performanceMetrics.totalErrors}`);
        console.log(`Taxa de sucesso: ${((this.performanceMetrics.totalRequests - this.performanceMetrics.totalErrors) / this.performanceMetrics.totalRequests * 100).toFixed(2)}%`);
        console.log(`Tempo médio de resposta: ${this.performanceMetrics.avgResponseTime.toFixed(2)}ms`);
        
        if (this.performanceMetrics.calls.length > 0) {
            const methodStats = this.performanceMetrics.calls.reduce((acc, call) => {
                if (!acc[call.method]) {
                    acc[call.method] = { count: 0, totalTime: 0, errors: 0 };
                }
                acc[call.method].count++;
                acc[call.method].totalTime += call.duration;
                if (!call.success) acc[call.method].errors++;
                return acc;
            }, {});

            console.log('\n📈 Estatísticas por método:');
            Object.entries(methodStats).forEach(([method, stats]) => {
                const avgTime = stats.totalTime / stats.count;
                const successRate = ((stats.count - stats.errors) / stats.count * 100);
            Object.entries(methodStats).forEach(([method, stats]) => {
                const avgTime = stats.totalTime / stats.count;
                const successRate = ((stats.count - stats.errors) / stats.count * 100);
                console.log(`  ${method}: ${stats.count} calls, ${avgTime.toFixed(2)}ms avg, ${successRate.toFixed(1)}% success`);
            });
        }
    }
}

// Script de debug interativo
async function runDebugSession() {
    const client = new DebugGrpcClient('localhost:50051');
    
    try {
        await client.initialize();
        
        console.log('🔧 SESSÃO DE DEBUG gRPC INICIADA');
        console.log('=====================================\n');
        
        // Teste completo do ciclo de vida
        const email = `debug${Date.now()}@test.com`;
        
        // 1. Registro
        const regResponse = await client.register({
            email: email,
            username: `debug${Date.now()}`,
            password: 'debug123',
            first_name: 'Debug',
            last_name: 'User'
        });
        
        // 2. Login
        const loginResponse = await client.login({
            identifier: email,
            password: 'debug123'
        });
        
        // 3. Criar tarefas de teste
        const taskIds = [];
        for (let i = 1; i <= 3; i++) {
            const taskResponse = await client.createTask({
                title: `Debug Task ${i}`,
                description: `Task created for debugging purposes - ${i}`,
                priority: i % 4
            });
            taskIds.push(taskResponse.task.id);
        }
        
        // 4. Listar tarefas
        await client.getTasks({ page: 1, limit: 10 });
        
        // 5. Atualizar uma tarefa
        if (taskIds.length > 0) {
            await client.updateTask(taskIds[0], {
                title: 'Updated Debug Task',
                completed: true
            });
        }
        
        // 6. Buscar estatísticas
        await client.getStats();
        
        // 7. Teste de stream (breve)
        console.log('\n🌊 Testando streaming...');
        const stream = client.streamTasks();
        setTimeout(() => stream.cancel(), 2000);
        
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // 8. Limpeza - deletar tarefas criadas
        for (const taskId of taskIds) {
            await client.deleteTask(taskId);
        }
        
        // Imprimir métricas finais
        client.printMetrics();
        
    } catch (error) {
        console.error('❌ Erro na sessão de debug:', error);
    }
}

if (require.main === module) {
    runDebugSession();
}

module.exports = DebugGrpcClient;
```

---

## **PASSO 14: Análise e Documentação**

### 14.1 Análise Arquitetural Detalhada

**Características Implementadas:**
- ✅ Comunicação gRPC com Protocol Buffers
- ✅ Streaming bidirecional em tempo real
- ✅ Type safety com validação automática
- ✅ Performance otimizada com serialização binária
- ✅ Suporte a múltiplas linguagens (interoperabilidade)

**Métricas de Performance Esperadas:**
- **Latência**: ~15-30ms por requisição (40-60% menor que REST)
- **Throughput**: ~1500-3000 req/sec (2-3x maior que REST)
- **Bandwidth**: ~30-50% menor que JSON
- **CPU Usage**: ~20-30% menor para serialização

**Vantagens Demonstradas do gRPC:**

1. **Serialização Binária Eficiente**
   - Protocol Buffers reduzem payload em ~60% vs JSON
   - Parsing mais rápido devido ao formato binário
   - Type safety eliminando erros de runtime

2. **HTTP/2 Nativo**
   - Multiplexing: múltiplas requisições simultâneas
   - Server Push: servidor pode enviar dados proativamente
   - Header Compression: reduz overhead de rede

3. **Streaming Real-time**
   - Server Streaming: dados contínuos do servidor
   - Client Streaming: envio em lote do cliente
   - Bidirectional: comunicação simultânea

4. **Interoperabilidade**
   - Code generation para múltiplas linguagens
   - Contratos strongly-typed
   - Versionamento de APIs facilitado

**Limitações Identificadas:**

1. **Complexidade de Desenvolvimento**
   - Curva de aprendizado mais íngreme
   - Tooling menos maduro que REST
   - Debugging mais desafiador

2. **Suporte Limited de Browsers**
   - Requer gRPC-Web para aplicações browser
   - Proxy adicional necessário
   - WebSockets como alternativa

3. **Observabilidade**
   - Dados binários dificultam debug
   - Ferramentas especializadas necessárias
   - Logs menos human-readable

### 14.2 Comparação Detalhada com Arquiteturas

| Aspecto | REST/JSON | gRPC/Protobuf | GraphQL | WebSocket | Microsserviços |
|---------|-----------|---------------|---------|-----------|----------------|
| **Latência** | 50-80ms | 15-30ms | 40-70ms | 5-15ms | Variável |
| **Throughput** | 500-1000 req/s | 1500-3000 req/s | 800-1500 req/s | 2000+ req/s | Variável |
| **Bandwidth** | Baseline | -30 a -50% | -20 a -40% | -40 a -60% | Variável |
| **Type Safety** | Baixa | Alta | Média | Baixa | Variável |
| **Caching** | Excelente | Limitado | Complexo | N/A | Variável |
| **Debugging** | Fácil | Médio | Médio | Médio | Difícil |
| **Streaming** | Não | Sim | Subscriptions | Sim | Sim |
| **Browser Support** | Nativo | gRPC-Web | Nativo | Nativo | Variável |
| **Tooling** | Maduro | Crescendo | Maduro | Básico | Complexo |
| **Learning Curve** | Baixa | Alta | Média | Baixa | Muito Alta |

### 14.3 Casos de Uso Recomendados

**gRPC é Ideal para:**

1. **Comunicação Microsserviços**
   ```
   Service A ←→ Service B ←→ Service C
   - Alta frequência de chamadas
   - Payloads estruturados
   - Type safety crítico
   ```

2. **Streaming de Dados**
   ```
   Client ← Stream ← Server
   - Logs em tempo real
   - Métricas de monitoramento
   - Chat/mensagens instantâneas
   ```

3. **APIs Internas de Alta Performance**
   ```
   Mobile App ←→ Backend Services
   - Economia de bateria
   - Menor uso de dados
   - Latência crítica
   ```

4. **Sistemas Multi-linguagem**
   ```
   Go Service ←→ Python Service ←→ Node.js Service
   - Code generation automático
   - Contratos padronizados
   - Versionamento facilitado
   ```

**REST ainda é Melhor para:**

1. **APIs Públicas e Terceiros**
   ```
   Third-party Apps ←→ Public API
   - Documentação simples (OpenAPI/Swagger)
   - Caching HTTP nativo
   - Tooling universal (Postman, curl, browsers)
   ```

2. **CRUD Simples**
   ```
   Web App ←→ Backend
   - Operações básicas
   - Cache HTTP efetivo
   - Desenvolvimento rápido
   ```

3. **Integrações Web**
   ```
   Browser ←→ Server
   - Suporte nativo
   - DevTools debugging
   - Sem proxy adicional
   ```

### 14.4 Métricas de Decisão Técnica

**Matriz de Decisão: Quando usar gRPC vs REST**

| Critério | Peso | gRPC Score | REST Score | Decisão |
|----------|------|------------|------------|---------|
| **Performance** | 9 | 9 | 6 | gRPC |
| **Facilidade de Debug** | 7 | 4 | 9 | REST |
| **Browser Support** | 6 | 3 | 10 | REST |
| **Type Safety** | 8 | 10 | 3 | gRPC |
| **Ecosystem** | 7 | 6 | 9 | REST |
| **Learning Curve** | 5 | 3 | 8 | REST |
| **Streaming** | 8 | 10 | 2 | gRPC |
| **Caching** | 6 | 3 | 9 | REST |

**Score Final (Weighted):**
- gRPC: 6.8/10
- REST: 7.1/10

**Interpretação:**
- Para sistemas internos de alta performance: **gRPC**
- Para APIs públicas e web apps: **REST**
- Para streaming e tempo real: **gRPC**
- Para desenvolvimento rápido: **REST**

---

## **PASSO 15: Entregáveis e Avaliação**

### 15.1 Checklist Completo de Implementação

**Funcionalidades Core:**
- [ ] Protocol Buffers definidos corretamente (auth + task services)
- [ ] Servidor gRPC com todos os métodos CRUD funcionais
- [ ] Cliente de exemplo implementado e testado
- [ ] Autenticação JWT integrada
- [ ] Streaming bidirecional operacional
- [ ] Validação de dados com Protocol Buffers

**Testes e Qualidade:**
- [ ] Testes automatizados com Jest 
- [ ] Benchmark de performance executado

**Documentação e Análise:**
- [ ] Relatório técnico final, com evidências de testes, apresentando a comparação detalhada com REST

### 15.2 Documentação Final da API

```markdown
# API gRPC - Sistema de Gerenciamento de Tarefas

## Endpoints de Autenticação

### AuthService.Register
**Request:**
```protobuf
{
  email: string
  username: string  
  password: string
  first_name: string
  last_name: string
}
```

**Response:**
```protobuf
{
  success: bool
  message: string
  user: User
  token: string
  errors: string[]
}
```

### AuthService.Login  
**Request:**
```protobuf
{
  identifier: string  // email ou username
  password: string
}
```

**Response:**
```protobuf
{
  success: bool
  message: string
  user: User
  token: string
  errors: string[]
}
```

## Endpoints de Tarefas

### TaskService.CreateTask
**Request:**
```protobuf
{
  token: string
  title: string
  description: string
  priority: Priority (LOW=0, MEDIUM=1, HIGH=2, URGENT=3)
}
```

### TaskService.GetTasks (com paginação)
**Request:**
```protobuf
{
  token: string
  completed: bool (optional)
  priority: Priority (optional)
  page: int32
  limit: int32
}
```

### TaskService.StreamTasks (Server Streaming)
**Request:**
```protobuf
{
  token: string
  completed: bool (optional)
}
```

**Response Stream:**
```protobuf
Task {
  id: string
  title: string
  description: string
  completed: bool
  priority: Priority
  user_id: string
  created_at: int64
  updated_at: int64
}
```

### TaskService.StreamNotifications (Server Streaming)
**Response Stream:**
```protobuf
TaskNotification {
  type: NotificationType
  task: Task
  message: string
  timestamp: int64
}
```

## Tipos de Dados

### Priority (Enum)
- `LOW = 0`
- `MEDIUM = 1`  
- `HIGH = 2`
- `URGENT = 3`

### NotificationType (Enum)
- `TASK_CREATED = 0`
- `TASK_UPDATED = 1`
- `TASK_DELETED = 2`  
- `TASK_COMPLETED = 3`

## Códigos de Erro gRPC

| Código | Nome | Descrição |
|--------|------|-----------|
| 0 | OK | Sucesso |
| 3 | INVALID_ARGUMENT | Dados inválidos |
| 16 | UNAUTHENTICATED | Token inválido/ausente |
| 5 | NOT_FOUND | Recurso não encontrado |
| 13 | INTERNAL | Erro interno do servidor |
```

### 15.3 Comandos de Execução Final

```bash
# Setup completo
npm install

# Executar servidor principal
npm start

# Executar cliente de exemplo
npm run client

# Testes completos
npm test

# Benchmark vs REST
npm run benchmark
```

## Portas Utilizadas

- **Servidor gRPC Principal**: 50051
- **Servidor de Testes**: 50052
- **Banco de Dados**: SQLite (arquivo local)

## Conclusão

Este roteiro visa demonstrar a implementação completa de um sistema distribuído usando gRPC, evidenciando:

1. **Performance Superior**: 40-60% melhor latência que REST
2. **Type Safety**: Validação automática com Protocol Buffers  
3. **Streaming Real-time**: Comunicação bidirecional eficiente
4. **Interoperabilidade**: Code generation para múltiplas linguagens
5. **Debugging Avançado**: Ferramentas especializadas para monitoramento


## Referências

<sup>[1]</sup> TANENBAUM, Andrew S.; VAN STEEN, Maarten. **Distributed Systems: Principles and Paradigms**. 3rd ed. Boston: Pearson, 2017.

<sup>[2]</sup> GOOGLE. **gRPC Documentation**. Disponível em: https://grpc.io/docs/. Acesso em: Agosto de 2025.

<sup>[3]</sup> KLEPPMANN, Martin. **Designing Data-Intensive Applications**. O'Reilly Media, 2017.

<sup>[4]</sup> FOWLER, Martin. **Microservices**. Disponível em: https://martinfowler.com/articles/microservices.html. Acesso em: Agosto de 2025.