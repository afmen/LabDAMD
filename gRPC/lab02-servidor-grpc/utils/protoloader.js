const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class ProtoLoader {
    constructor() {
        this.packageDefinitions = new Map();
        this.services = new Map();
    }

    /**
     * Carrega um arquivo .proto e retorna o service definition necessário para addService
     * @param {string} protoFile - nome do arquivo .proto
     * @param {string} packageName - nome do package dentro do proto
     * @returns {object} { serviceDefinition, servicePackage }
     */
    loadProto(protoFile, packageName) {
        const PROTO_PATH = path.join(__dirname, '../protos', protoFile);

        // Carrega o proto
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

        // Acesso seguro ao package (suporta packages aninhados)
        const packageParts = packageName.split('.');
        let servicePackage = protoDescriptor;
        for (const part of packageParts) {
            servicePackage = servicePackage[part];
            if (!servicePackage) {
                throw new Error(`Package "${packageName}" não encontrado no proto ${protoFile}`);
            }
        }

        // Encontrar service(s) no package
        const serviceNames = Object.keys(servicePackage).filter(k => typeof servicePackage[k] === 'function');
        if (serviceNames.length === 0) {
            throw new Error(`Nenhum service encontrado no package "${packageName}" do proto ${protoFile}`);
        }

        // Pega o service definition necessário para addService
        const mainServiceName = serviceNames[0];
        const serviceDefinition = servicePackage[mainServiceName].service;

        // Armazena referências
        this.packageDefinitions.set(packageName, packageDefinition);
        this.services.set(packageName, servicePackage);

        console.log(`✅ Proto "${protoFile}" carregado com sucesso, services: ${serviceNames.join(', ')}`);

        return { serviceDefinition, servicePackage };
    }

    getService(packageName) {
        return this.services.get(packageName);
    }

    // ---------- Utilitários ----------

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
