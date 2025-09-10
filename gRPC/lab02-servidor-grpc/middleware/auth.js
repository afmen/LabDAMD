// middleware/authInterceptor.js
const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

const config = {
    jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui'
};

class AuthInterceptor {
    /**
     * Intercepta chamadas gRPC e valida JWT nos metadados.
     */
    static createInterceptor() {
        return (options, nextCall) => {
            return new grpc.InterceptingCall(nextCall(options), {
                start: function (metadata, listener, next) {
                    const authHeader = metadata.get('authorization')[0];

                    if (!authHeader) {
                        // Se não houver token, retorna UNAUTHENTICATED
                        listener.onReceiveStatus({
                            code: grpc.status.UNAUTHENTICATED,
                            details: 'Token ausente'
                        });
                        return;
                    }

                    const token = authHeader.replace('Bearer ', '');

                    try {
                        const decoded = jwt.verify(token, config.jwtSecret);
                        // Adiciona dados do usuário no call.user
                        options.call.user = decoded;
                    } catch (err) {
                        listener.onReceiveStatus({
                            code: grpc.status.UNAUTHENTICATED,
                            details: 'Token inválido'
                        });
                        return;
                    }

                    next(metadata, listener);
                }
            });
        };
    }
}

module.exports = AuthInterceptor;
