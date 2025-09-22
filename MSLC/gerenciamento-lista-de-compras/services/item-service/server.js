const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');

// Importar banco NoSQL e service registry
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ItemService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3002;
        this.serviceName = 'item-service';
        this.serviceUrl = `http://127.0.0.1:${this.port}`;

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.seedInitialData();
    }

    setupDatabase() {
        const dbPath = path.join(__dirname, 'database');
        this.itemsDb = new JsonDatabase(dbPath, 'items');
        console.log('Item Service: Banco NoSQL inicializado');
    }

    async seedInitialData() {
        setTimeout(async () => {
            try {
                const existingItems = await this.itemsDb.find();
                if (existingItems.length === 0) {
                    const sampleItems = [
                        // Alimentos
                        { id: uuidv4(), name: "Arroz Branco", category: "Alimentos", brand: "Tio João", unit: "kg", averagePrice: 25.90, barcode: "7891000100101", description: "Arroz tipo 1, pacote 5kg", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Feijão Carioca", category: "Alimentos", brand: "Kicaldo", unit: "kg", averagePrice: 9.80, barcode: "7896000100102", description: "Feijão carioca tipo 1, pacote 1kg", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Macarrão Espaguete", category: "Alimentos", brand: "Renata", unit: "kg", averagePrice: 6.50, barcode: "7897000100103", description: "Macarrão tipo espaguete, pacote 500g", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Açúcar Refinado", category: "Alimentos", brand: "União", unit: "kg", averagePrice: 4.20, barcode: "7898000100104", description: "Açúcar refinado, pacote 1kg", active: true, createdAt: new Date().toISOString() },

                        // Limpeza
                        { id: uuidv4(), name: "Detergente Líquido", category: "Limpeza", brand: "Ypê", unit: "litro", averagePrice: 2.90, barcode: "7899000100105", description: "Detergente líquido neutro, frasco 500ml", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Sabão em Pó", category: "Limpeza", brand: "Omo", unit: "kg", averagePrice: 24.50, barcode: "7891000200106", description: "Sabão em pó 2kg", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Desinfetante", category: "Limpeza", brand: "Veja", unit: "litro", averagePrice: 7.90, barcode: "7892000200107", description: "Desinfetante pinho 1L", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Água Sanitária", category: "Limpeza", brand: "QBoa", unit: "litro", averagePrice: 5.50, barcode: "7893000200108", description: "Água sanitária tradicional 2L", active: true, createdAt: new Date().toISOString() },

                        // Higiene
                        { id: uuidv4(), name: "Sabonete em Barra", category: "Higiene", brand: "Lux", unit: "un", averagePrice: 2.20, barcode: "7894000300109", description: "Sabonete perfumado 90g", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Shampoo", category: "Higiene", brand: "Seda", unit: "litro", averagePrice: 15.00, barcode: "7895000300110", description: "Shampoo hidratação 325ml", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Creme Dental", category: "Higiene", brand: "Colgate", unit: "un", averagePrice: 5.80, barcode: "7896000300111", description: "Creme dental 90g", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Desodorante Roll-on", category: "Higiene", brand: "Nivea", unit: "un", averagePrice: 11.50, barcode: "7897000300112", description: "Desodorante antitranspirante 50ml", active: true, createdAt: new Date().toISOString() },

                        // Bebidas
                        { id: uuidv4(), name: "Refrigerante Cola", category: "Bebidas", brand: "Coca-Cola", unit: "litro", averagePrice: 9.00, barcode: "7898000400113", description: "Refrigerante 2L", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Suco de Laranja", category: "Bebidas", brand: "Del Valle", unit: "litro", averagePrice: 7.80, barcode: "7899000400114", description: "Suco de laranja 1L", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Água Mineral", category: "Bebidas", brand: "Crystal", unit: "litro", averagePrice: 2.50, barcode: "7891000400115", description: "Água mineral sem gás 500ml", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Cerveja Pilsen", category: "Bebidas", brand: "Skol", unit: "litro", averagePrice: 5.00, barcode: "7892000400116", description: "Cerveja lata 350ml", active: true, createdAt: new Date().toISOString() },

                        // Padaria
                        { id: uuidv4(), name: "Pão Francês", category: "Padaria", brand: "Padaria Local", unit: "kg", averagePrice: 14.00, barcode: "7893000500117", description: "Pão francês fresco por kg", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Bolo de Chocolate", category: "Padaria", brand: "Padaria Local", unit: "un", averagePrice: 30.00, barcode: "7894000500118", description: "Bolo de chocolate 1kg", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Croissant", category: "Padaria", brand: "Padaria Local", unit: "un", averagePrice: 6.00, barcode: "7895000500119", description: "Croissant amanteigado", active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: "Pão de Queijo", category: "Padaria", brand: "Padaria Mineira", unit: "kg", averagePrice: 22.00, barcode: "7896000500120", description: "Pão de queijo congelado por kg", active: true, createdAt: new Date().toISOString() },
                    ];

                    for (const item of sampleItems) {
                        await this.itemsDb.create(item);
                    }

                    console.log('Itens iniciais criados com sucesso!');
                }
            } catch (error) {
                console.error('Erro ao criar dados iniciais:', error);
            }
        }, 1000);
    }
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Service info headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Service', this.serviceName);
            res.setHeader('X-Service-Version', '1.0.0');
            res.setHeader('X-Database', 'JSON-NoSQL');
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                const itemCount = await this.itemsDb.count();
                const activeItems = await this.itemsDb.count({ active: true });

                res.json({
                    service: this.serviceName,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    version: '1.0.0',
                    database: {
                        type: 'JSON-NoSQL',
                        itemCount: itemCount,
                        activeItems: activeItems
                    }
                });
            } catch (error) {
                res.status(503).json({
                    service: this.serviceName,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        });

        // Service info
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Item Service',
                version: '1.0.0',
                description: 'Gerenciamento de Lista de Compras',
                database: 'JSON-NoSQL',
                endpoints: [
                    'GET /items',
                    'GET /items/:id',
                    'POST /items',
                    'PUT /items/:id',
                    //'DELETE /items/:id',
                    //'PUT /items/:id/brand',
                    'GET /categories',
                    'GET /search?=termo'
                ]
            });
        });

        // Item routes
        this.app.get('/items', this.getItems.bind(this));
        this.app.get('/items/:id', this.getItem.bind(this));
        this.app.post('/items', this.authMiddleware.bind(this), this.createItem.bind(this));
        this.app.put('/items/:id', this.authMiddleware.bind(this), this.updateItem.bind(this));
        //this.app.delete('/items/:id', this.authMiddleware.bind(this), this.deleteItem.bind(this));
        //this.app.put('/items/:id/brand', this.authMiddleware.bind(this), this.updateBrand.bind(this));

        // Category routes (extraídas dos items)
        this.app.get('/categories', this.getCategories.bind(this));

        // Search route
        this.app.get('/search', this.searchItems.bind(this));
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                service: this.serviceName
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Item Service Error:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do serviço',
                service: this.serviceName
            });
        });
    }

    // Auth middleware (valida token com User Service)
    async authMiddleware(req, res, next) {
        const authHeader = req.header('Authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token obrigatório'
            });
        }

        try {
            // Descobrir User Service
            const userService = serviceRegistry.discover('user-service');

            // Validar token com User Service
            const response = await axios.post(`${userService.url}/auth/validate`, {
                token: authHeader.replace('Bearer ', '')
            }, { timeout: 5000 });

            if (response.data.success) {
                req.user = response.data.data.user;
                next();
            } else {
                res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
            }
        } catch (error) {
            console.error('Erro na validação do token:', error.message);
            res.status(503).json({
                success: false,
                message: 'Serviço de autenticação indisponível'
            });
        }
    }

    // Get items (com filtros e paginação)
    async getItems(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                category,
                minAveragePrice,
                maxAveragePrice,
                search,
                active = true,
                //featured
            } = req.query;

            const skip = (page - 1) * parseInt(limit);

            // Filtros NoSQL flexíveis
            const filter = { active: active === 'true' };

            // Filtrar por categoria
            if (category) {
                filter['category'] = category;
            }

            // Filtrar por destaque
            /*if (featured !== undefined) {
                filter.featured = featured === 'true';
            }*/

            // Filtrar por preço
            if (minAveragePrice) {
                filter.averagePrice = { $gte: parseFloat(minAveragePrice) };
            }
            if (maxAveragePrice) {
                if (filter.averagePrice) {
                    filter.averagePrice.$lte = parseFloat(maxAveragePrice);
                } else {
                    filter.averagePrice = { $lte: parseFloat(maxAveragePrice) };
                }
            }

            let items;

            // Se há busca por texto, usar método de search
            if (search) {
                items = await this.itemsDb.search(search, ['name', 'category', 'brand', 'description']);
                // Aplicar outros filtros manualmente
                items = items.filter(item => {
                    for (const [key, value] of Object.entries(filter)) {
                        if (key === 'averagePrice') {
                            if (value.$gte && item.averagePrice < value.$gte) return false;
                            if (value.$lte && item.averagePrice > value.$lte) return false;
                        } else if (key.includes('.')) {
                            // Campos aninhados (ex: category.slug)
                            const keys = key.split('.');
                            const itemValue = keys.reduce((obj, k) => obj?.[k], item);
                            if (itemValue !== value) return false;
                        } else if (item[key] !== value) {
                            return false;
                        }
                    }
                    return true;
                });
                // Aplicar paginação manual
                items = items.slice(skip, skip + parseInt(limit));
            } else {
                items = await this.itemsDb.find(filter, {
                    skip: skip,
                    limit: parseInt(limit),
                    sort: { createdAt: -1 }
                });
            }

            const total = await this.itemsDb.count(filter);

            res.json({
                success: true,
                data: items,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Erro ao buscar items:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Get item by ID
    async getItem(req, res) {
        try {
            const { id } = req.params;
            const item = await this.itemsDb.findById(id);

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            res.json({
                success: true,
                data: item
            });
        } catch (error) {
            console.error('Erro ao buscar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Create item (demonstrando schema NoSQL flexível)
    async createItem(req, res) {
        try {
            const {
                name,
                //price, 
                //stock, 
                category,
                brand,
                unit,
                averagePrice,
                barcode,
                description,
                //images, 
                //specifications,
                //featured = false
            } = req.body;

            if (!name || !category || !unit || !averagePrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome, categoria, unidade e preço médio são obrigatórios'
                });
            }

            // Criar item com schema NoSQL flexível
            const newItem = await this.itemsDb.create({
                id: uuidv4(),
                name,
                category,        // string simples
                brand,
                unit,            // "kg", "un", "litro"
                averagePrice,
                barcode,
                description: description || '',
                active: true,
                createdAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso',
                data: newItem
            });
        } catch (error) {
            console.error('Erro ao criar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Update item (demonstrando flexibilidade NoSQL)
    async updateItem(req, res) {
        try {
            const { id } = req.params;
            const {
                name,
                category,
                brand,
                unit,
                averagePrice,
                barcode,
                description,
                active
            } = req.body;

            const item = await this.itemsDb.findById(id);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            // Updates flexíveis com NoSQL
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (category !== undefined) updates.category = category;
            if (brand !== undefined) updates.brand = brand;
            if (unit !== undefined) updates.unit = unit;
            if (averagePrice !== undefined) updates.averagePrice = averagePrice;
            if (barcode !== undefined) updates.barcode = barcode;
            if (description !== undefined) updates.description = description;
            if (active !== undefined) updates.active = active;

            // Adicionar metadata de atualização
            updates['metadata.lastUpdatedBy'] = req.user.id;
            updates['metadata.lastUpdatedByName'] = `${req.user.firstName} ${req.user.lastName}`;
            updates['metadata.lastUpdatedAt'] = new Date().toISOString();

            const updatedItem = await this.itemsDb.update(id, updates);

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: updatedItem
            });
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Delete item (soft delete)
    async deleteItem(req, res) {
        try {
            const { id } = req.params;

            const item = await this.itemsDb.findById(id);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            // Soft delete - desativar item
            await this.itemsDb.update(id, {
                active: false,
                'metadata.deletedBy': req.user.id,
                'metadata.deletedByName': `${req.user.firstName} ${req.user.lastName}`,
                'metadata.deletedAt': new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item removido com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Update brand
    async updateBrand(req, res) {
        try {
            const { id } = req.params;
            const { brand } = req.body;

            if (!brand || typeof brand !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'A nova marca deve ser fornecida como string'
                });
            }

            const item = await this.itemsDb.findById(id);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            const previousBrand = item.brand;

            const updatedItem = await this.itemsDb.update(id, {
                brand: brand,
                'metadata.lastBrandUpdate': new Date().toISOString(),
                'metadata.lastBrandUpdateBy': req.user.id
            });

            res.json({
                success: true,
                message: 'Marca atualizada com sucesso',
                data: {
                    itemId: id,
                    previousBrand: previousBrand,
                    newBrand: updatedItem.brand
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar marca:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Get categories (extraídas dos Items)
    async getCategories(req, res) {
        try {
            const items = await this.itemsDb.find();
            const categories = [...new Set(items.map(item => item.category))];
            res.json(categories);
        } catch (error) {
            console.error("Erro ao listar categorias:", error);
            res.status(500).json({ error: "Erro ao listar categorias" });
        }

    }

    // Search items (demonstrando busca NoSQL)
    async searchItems(req, res) {
        try {
            const { q, limit = 20, category } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Parâmetro de busca "q" é obrigatório'
                });
            }

            // Busca full-text NoSQL
            let items = await this.itemsDb.search(q, ['name', 'category', 'brand', 'description']);

            // Filtrar apenas items ativos
            items = items.filter(item => item.active);

            // Filtrar por categoria se especificada
            if (category) {
                items = items.filter(item => item.category === category);
            }


            // Aplicar limite
            items = items.slice(0, parseInt(limit));

            res.json({
                success: true,
                data: {
                    query: q,
                    category: category || null,
                    results: items,
                    total: items.length
                }
            });
        } catch (error) {
            console.error('Erro na busca de items:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Register with service registry
    registerWithRegistry() {
        serviceRegistry.register(this.serviceName, {
            url: this.serviceUrl,
            version: '1.0.0',
            database: 'JSON-NoSQL',
            endpoints: ['/health', '/items', '/categories', '/search']
        });
    }

    // Start health check reporting
    startHealthReporting() {
        setInterval(() => {
            serviceRegistry.updateHealth(this.serviceName, true);
        }, 30000);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`Item Service iniciado na porta ${this.port}`);
            console.log(`URL: ${this.serviceUrl}`);
            console.log(`Health: ${this.serviceUrl}/health`);
            console.log(`Database: JSON-NoSQL`);
            console.log('=====================================');

            // Register with service registry
            this.registerWithRegistry();
            this.startHealthReporting();
        });
    }
}

// Start service
if (require.main === module) {
    const itemService = new ItemService();
    itemService.start();

    // Graceful shutdown
    process.on('SIGTERM', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
}

module.exports = ItemService;