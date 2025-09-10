const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');
const jwt = require('jsonwebtoken');

class AuthService {

    /**
     * Registro de usuário
     */
    async register(call, callback) {
        try {
            const { email, username, password, first_name, last_name } = call.request;

            // Validações básicas
            if (!email || !username || !password || !first_name || !last_name) {
                const error = new Error('Todos os campos são obrigatórios');
                error.code = grpc.status.INVALID_ARGUMENT;
                return callback(error);
            }

            // Verificar se usuário já existe
            const existingUser = await database.get(
                'SELECT * FROM users WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingUser) {
                const error = new Error('Email ou username já existe');
                error.code = grpc.status.ALREADY_EXISTS;
                return callback(error);
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
            const grpcError = new Error('Erro interno do servidor');
            grpcError.code = grpc.status.INTERNAL;
            callback(grpcError);
        }
    }

    /**
     * Login de usuário
     */
    async login(call, callback) {
        try {
            const { identifier, password } = call.request;

            if (!identifier || !password) {
                const error = new Error('Email/username e senha são obrigatórios');
                error.code = grpc.status.INVALID_ARGUMENT;
                return callback(error);
            }

            const userData = await database.get(
                'SELECT * FROM users WHERE email = ? OR username = ?',
                [identifier, identifier]
            );

            if (!userData) {
                const error = new Error('Credenciais inválidas');
                error.code = grpc.status.NOT_FOUND;
                return callback(error);
            }

            const user = new User(userData);
            const isValidPassword = await user.comparePassword(password);

            if (!isValidPassword) {
                const error = new Error('Senha incorreta');
                error.code = grpc.status.PERMISSION_DENIED;
                return callback(error);
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
            const grpcError = new Error('Erro interno do servidor');
            grpcError.code = grpc.status.INTERNAL;
            callback(grpcError);
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
                const error = new Error('Token não fornecido');
                error.code = grpc.status.UNAUTHENTICATED;
                return callback(error);
            }

            const decoded = jwt.verify(token, jwtSecret);

            // Buscar dados atualizados do usuário
            const userData = await database.get('SELECT * FROM users WHERE id = ?', [decoded.id]);

            if (!userData) {
                const error = new Error('Usuário não encontrado');
                error.code = grpc.status.NOT_FOUND;
                return callback(error);
            }

            const user = new User(userData);

            callback(null, {
                valid: true,
                user: user.toProtobuf(),
                message: 'Token válido'
            });
        } catch (error) {
            console.error('Erro na validação do token:', error);
            const grpcError = new Error('Token inválido');
            grpcError.code = grpc.status.UNAUTHENTICATED;
            callback(grpcError);
        }
    }
}

module.exports = AuthService;
