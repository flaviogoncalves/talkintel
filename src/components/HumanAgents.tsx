import React, { useState, useEffect } from 'react';
import { Users, Award, Clock, MessageCircle, Database } from 'lucide-react';
import AgentCard from './AgentCard';
import StatCard from './StatCard';
import DataStorageService from '../services/dataStorage';
import { mockAgentMetrics } from '../services/mockData';

const HumanAgents: React.FC = () => {
  const [agents, setAgents] = useState(mockAgentMetrics);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    const storedAgents = DataStorageService.getAllAgents();
    const storedAnalyses = DataStorageService.getAllCallAnalyses();
    
    if (storedAgents.length > 0) {
      setAgents(storedAgents);
      setHasRealData(true);
    } else if (storedAnalyses.length > 0) {
      // If we have analyses but no agent data, use mock agents
      setHasRealData(true);
    }
  }, []);

  const humanAgents = agents.filter(agent => agent.type === 'human');
  
  const humanStats = {
    totalAgents: humanAgents.length,
    avgSatisfaction: humanAgents.length > 0 
      ? humanAgents.reduce((sum, agent) => sum + agent.satisfactionScore, 0) / humanAgents.length 
      : 0,
    totalCalls: humanAgents.reduce((sum, agent) => sum + agent.totalCalls, 0),
    avgCallQuality: humanAgents.length > 0 
      ? humanAgents.reduce((sum, agent) => sum + (agent.callQuality || 0), 0) / humanAgents.length 
      : 0
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Análise de Agentes Humanos</h1>
        <p className="text-gray-400">Insights de performance da sua equipe de atendimento humano</p>
        
        {/* Data Source Indicator */}
        <div className={`inline-flex items-center space-x-2 text-sm px-3 py-1 rounded-full border ${
          hasRealData 
            ? 'text-green-400 bg-green-500/20 border-green-500/30' 
            : 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
        }`}>
          <Database className="w-4 h-4" />
          <span>{hasRealData ? 'Dados Reais' : 'Dados Simulados'}</span>
        </div>
      </div>

      {/* Human Agent Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Agentes Humanos"
          value={humanStats.totalAgents}
          icon={Users}
          className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20"
        />
        <StatCard
          title="Satisfação Média"
          value={humanStats.avgSatisfaction.toFixed(1)}
          icon={Award}
          suffix="/5"
          change={hasRealData ? 4.2 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
        <StatCard
          title="Total de Chamadas"
          value={humanStats.totalCalls}
          icon={MessageCircle}
          change={hasRealData ? 8.5 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
        <StatCard
          title="Qualidade Média"
          value={(humanStats.avgCallQuality || 0).toFixed(1)}
          icon={Clock}
          suffix="/5"
          change={hasRealData ? 0.3 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
      </div>

      {/* Individual Agent Performance */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Performance Individual</h2>
        {humanAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {humanAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum Agente Humano Encontrado</h3>
            <p className="text-gray-400">
              Faça upload de dados ou configure webhooks para ver métricas de agentes humanos.
            </p>
          </div>
        )}
      </div>

      {/* Performance Insights */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Insights de Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Pontos Fortes</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Altos scores de satisfação do cliente</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Excelente capacidade de resolução de problemas</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Forte inteligência emocional</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Áreas para Melhoria</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Otimização do tempo de resposta</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Treinamento para questões complexas</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Consistência entre todos os agentes</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HumanAgents;