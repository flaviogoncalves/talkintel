import React, { useState, useEffect } from 'react';
import { Bot, Zap, Clock, MessageCircle, Database } from 'lucide-react';
import AgentCard from './AgentCard';
import StatCard from './StatCard';
import DataStorageService from '../services/dataStorage';
import { mockAgentMetrics } from '../services/mockData';

const AIAgents: React.FC = () => {
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

  const aiAgents = agents.filter(agent => agent.type === 'ai');
  
  const aiStats = {
    totalAgents: aiAgents.length,
    avgSatisfaction: aiAgents.length > 0 
      ? aiAgents.reduce((sum, agent) => sum + agent.satisfactionScore, 0) / aiAgents.length 
      : 0,
    totalCalls: aiAgents.reduce((sum, agent) => sum + agent.totalCalls, 0),
    avgCallQuality: aiAgents.length > 0 
      ? aiAgents.reduce((sum, agent) => sum + (agent.callQuality || 0), 0) / aiAgents.length 
      : 0
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Análise de Agentes IA</h1>
        <p className="text-gray-400">Métricas de performance dos seus assistentes de inteligência artificial</p>
        
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

      {/* AI Agent Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Agentes IA"
          value={aiStats.totalAgents}
          icon={Bot}
          className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20"
        />
        <StatCard
          title="Satisfação Média"
          value={(aiStats.avgSatisfaction * 2).toFixed(1)}
          icon={Zap}
          suffix="/10"
          change={hasRealData ? 6.8 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
        <StatCard
          title="Total de Chamadas"
          value={aiStats.totalCalls}
          icon={MessageCircle}
          change={hasRealData ? 15.2 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
        <StatCard
          title="Qualidade Média"
          value={((aiStats.avgCallQuality || 0) * 2).toFixed(1)}
          icon={Clock}
          suffix="/10"
          change={hasRealData ? 0.5 : undefined}
          changeType={hasRealData ? "up" : undefined}
        />
      </div>

      {/* Individual AI Agent Performance */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Performance dos Agentes IA</h2>
        {aiAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <Bot className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum Agente IA Encontrado</h3>
            <p className="text-gray-400">
              Faça upload de dados ou configure webhooks para ver métricas de agentes IA.
            </p>
          </div>
        )}
      </div>

      {/* AI Performance Insights */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Insights de Performance IA</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Vantagens da IA</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Tempos de resposta ultra-rápidos</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Disponibilidade 24/7</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Qualidade de serviço consistente</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Escalável para alto volume</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Áreas de Otimização</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Tratamento de consultas complexas</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Melhoria da inteligência emocional</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Aprimoramento da compreensão de contexto</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-400">Otimização do handoff para humanos</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgents;