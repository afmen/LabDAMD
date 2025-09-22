// api-gateway/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

// Service registry compartilhado
const serviceRegistry = require('../shared/serviceRegistry');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.circuitBreakers = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();

        setTimeout(() => this.startHealthChecks(), 3000);
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            res.setHeader('X-Gateway', 'api-gateway');
            res.setHeader('X-Gateway-Version', '1.0.0');
            res.setHeader('X-Architecture', 'Microservices-NoSQL');
            console.log(`${req.method} ${req.originalUrl} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        // Health check do gateway
        this.app.get('/health', async (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                service: 'api-gateway',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                architecture: 'Microservices with NoSQL',
                services,
                serviceCount: Object.keys(services).length
            });
        });

        // Service registry
        this.app.get('/registry', (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                success: true,
                services,
                count: Object.keys(services).length,
                timestamp: new Date().toISOString()
            });
        });

        // Roteamento para User Service
        this.app.use(['/api/auth', '/api/users'], (req, res, next) => {
            this.proxyRequest('user-service', req, res, next);
        });

        // Roteamento para Item Service
        this.app.use('/api/items', (req, res, next) => {
            this.proxyRequest('item-service', req, res, next);
        });

        // Roteamento para List Service
        this.app.use('/api/lists', (req, res, next) => {
            this.proxyRequest('list-service', req, res, next);
        });

        // Endpoints agregados
        this.app.get('/api/dashboard', this.getDashboard.bind(this));
        this.app.get('/api/search', this.globalSearch.bind(this));
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                service: 'api-gateway'
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Gateway Error:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do gateway',
                service: 'api-gateway'
            });
        });
    }

    async proxyRequest(serviceName, req, res, next) {
        try {
            if (this.isCircuitOpen(serviceName)) {
                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} temporariamente indisponível`
                });
            }

            const service = serviceRegistry.discover(serviceName);

            let targetPath = req.originalUrl;
            targetPath = targetPath.replace(/^\/api\/(auth|users|items|lists)/, '');
            if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;
            if (targetPath === '/') targetPath = `/${serviceName.split('-')[0]}s`;

            const targetUrl = `${service.url}${targetPath}`;

            const config = {
                method: req.method,
                url: targetUrl,
                headers: { ...req.headers },
                timeout: 10000,
                validateStatus: status => status < 500
            };

            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                config.data = req.body;
            }

            if (Object.keys(req.query).length > 0) {
                config.params = req.query;
            }

            delete config.headers.host;
            delete config.headers['content-length'];

            const response = await axios(config);
            this.resetCircuitBreaker(serviceName);
            res.status(response.status).json(response.data);
        } catch (error) {
            this.recordFailure(serviceName);
            console.error(`Proxy error for ${serviceName}:`, error.message);
            res.status(500).json({ success: false, message: 'Erro no gateway', service: serviceName });
        }
    }

    // Circuit breaker
    isCircuitOpen(serviceName) { /* ...mesmo que antes... */ }
    recordFailure(serviceName) { /* ...mesmo que antes... */ }
    resetCircuitBreaker(serviceName) { /* ...mesmo que antes... */ }

    // Dashboard agregado
    async getDashboard(req, res) {
        // Mesma lógica, mas substituindo produtos por items e listas
    }

    // Busca global
    async globalSearch(req, res) {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Parâmetro q obrigatório' });

        const authHeader = req.header('Authorization');

        const searches = [
            this.callService('item-service', '/search', 'GET', null, { q }),
            this.callService('list-service', '/search', 'GET', authHeader, { q })
        ];

        const [itemResults, listResults] = await Promise.allSettled(searches);

        res.json({
            success: true,
            data: {
                items: itemResults.status === 'fulfilled' ? itemResults.value.results : [],
                lists: listResults.status === 'fulfilled' ? listResults.value.results : []
            }
        });
    }

    async callService(serviceName, path, method = 'GET', authHeader = null, params = {}) {
        const service = serviceRegistry.discover(serviceName);
        const config = { method, url: `${service.url}${path}`, timeout: 5000 };
        if (authHeader) config.headers = { Authorization: authHeader };
        if (method === 'GET' && Object.keys(params).length > 0) config.params = params;
        const response = await axios(config);
        return response.data;
    }

    startHealthChecks() {
        setInterval(() => serviceRegistry.performHealthChecks(), 30000);
        setTimeout(() => serviceRegistry.performHealthChecks(), 5000);
    }

    start() {
        this.app.listen(this.port, () => console.log(`API Gateway rodando na porta ${this.port}`));
    }
}

if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start();
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

module.exports = APIGateway;
