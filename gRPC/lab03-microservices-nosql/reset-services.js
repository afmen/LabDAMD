#!/usr/bin/env node

// reset-services.js - Script para limpar e testar o sistema
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function resetAndTest() {
    console.log('='.repeat(60));
    console.log('RESET E TESTE DO SISTEMA DE MICROSSERVIÇOS');
    console.log('='.repeat(60));

    // 1. Limpar registry file
    console.log('\n1. Limpando Service Registry...');
    const registryFile = path.join(__dirname, 'shared', 'services-registry.json');
    
    if (fs.existsSync(registryFile)) {
        fs.unlinkSync(registryFile);
        console.log('Registry file removido:', registryFile);
    } else {
        console.log('Registry file não encontrado');
    }

    // 2. Criar novo registry vazio
    fs.writeFileSync(registryFile, '{}');
    console.log('Novo registry file criado');

    // 3. Aguardar serviços iniciarem
    console.log('\n2. Aguardando serviços iniciarem...');
    console.log('Por favor, inicie os serviços em ordem:');
    console.log('   Terminal 1: cd services/user-service && npm start');
    console.log('   Terminal 2: cd services/product-service && npm start');
    console.log('   Terminal 3: cd api-gateway && npm start');
    console.log('\nPressione Enter quando todos estiverem rodando...');
    
    // Aguardar input do usuário
    await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
    });

    // 4. Verificar serviços
    console.log('\n3. Verificando serviços...');
    
    const services = [
        { name: 'User Service', url: 'http://127.0.0.1:3001/health' },
        { name: 'Product Service', url: 'http://127.0.0.1:3002/health' },
        { name: 'API Gateway', url: 'http://127.0.0.1:3000/health' }
    ];

    let allHealthy = true;
    for (const service of services) {
        try {
            const response = await axios.get(service.url, { 
                timeout: 5000, 
                family: 4 
            });
            console.log(`✅ ${service.name}: OK (${response.status})`);
        } catch (error) {
            console.log(`❌ ${service.name}: ERRO - ${error.message}`);
            allHealthy = false;
        }
    }

    if (!allHealthy) {
        console.log('\n❌ Nem todos os serviços estão saudáveis. Verifique os logs.');
        return;
    }

    // 5. Aguardar registro
    console.log('\n4. Aguardando registro dos serviços...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Verificar registry
    console.log('\n5. Verificando Service Registry...');
    try {
        const registryResponse = await axios.get('http://127.0.0.1:3000/registry', { 
            timeout: 5000, 
            family: 4 
        });
        
        const registeredServices = registryResponse.data.services;
        console.log(`📊 Serviços registrados: ${Object.keys(registeredServices).length}`);
        
        Object.entries(registeredServices).forEach(([name, info]) => {
            const status = info.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY';
            console.log(`   ${name}: ${status} - ${info.url} (PID: ${info.pid})`);
        });
        
        // Verificar serviços esperados
        const expectedServices = ['user-service', 'product-service'];
        const missing = expectedServices.filter(s => !registeredServices[s]);
        
        if (missing.length > 0) {
            console.log(`❌ Serviços não registrados: ${missing.join(', ')}`);
            return;
        }
        
        console.log('✅ Todos os serviços esperados estão registrados');
        
    } catch (error) {
        console.log(`❌ Erro ao verificar registry: ${error.message}`);
        return;
    }

    // 7. Testar comunicação
    console.log('\n6. Testando comunicação...');
    
    // Teste direto
    try {
        const directResponse = await axios.get('http://127.0.0.1:3002/products', { 
            timeout: 5000, 
            family: 4 
        });
        console.log(`✅ Acesso direto ao Product Service: OK (${directResponse.status})`);
    } catch (error) {
        console.log(`❌ Acesso direto falhou: ${error.message}`);
        return;
    }

    // Teste via gateway
    try {
        const gatewayResponse = await axios.get('http://127.0.0.1:3000/api/products', { 
            timeout: 5000, 
            family: 4 
        });
        console.log(`✅ Acesso via Gateway: OK (${gatewayResponse.status})`);
        console.log(`📦 Produtos retornados: ${gatewayResponse.data.data?.length || 0}`);
    } catch (error) {
        console.log(`❌ Acesso via Gateway falhou: ${error.response?.status || 'NO_RESPONSE'}`);
        console.log(`   Erro: ${error.response?.data?.message || error.message}`);
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Sistema de microsserviços funcionando corretamente');
    console.log('='.repeat(60));
}

// Função para verificar status do registry
function showRegistryStatus() {
    const registryFile = path.join(__dirname, 'shared', 'services-registry.json');
    
    console.log('\nStatus do Registry File:');
    console.log('Arquivo:', registryFile);
    
    if (fs.existsSync(registryFile)) {
        try {
            const content = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
            console.log('Conteúdo:', JSON.stringify(content, null, 2));
        } catch (error) {
            console.log('Erro ao ler arquivo:', error.message);
        }
    } else {
        console.log('Arquivo não existe');
    }
}

// Função para limpar registry
function clearRegistry() {
    const registryFile = path.join(__dirname, 'shared', 'services-registry.json');
    if (fs.existsSync(registryFile)) {
        fs.unlinkSync(registryFile);
        console.log('Registry limpo');
    }
    fs.writeFileSync(registryFile, '{}');
    console.log('Novo registry criado');
}

// Executar baseado no argumento
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'status') {
        showRegistryStatus();
    } else if (command === 'clear') {
        clearRegistry();
    } else {
        resetAndTest().catch(console.error);
    }
}

module.exports = { resetAndTest, showRegistryStatus, clearRegistry };