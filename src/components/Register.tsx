import React, { useState } from 'react';
import { Building, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { API_CONFIG, buildUrl, createAuthHeaders } from '../config/api';

interface RegisterProps {
  onRegistrationSuccess: (result: any) => void;
  onSwitchToLogin: () => void;
}

interface CompanyFormData {
  name: string;
  domain: string;
  subscriptionTier: 'basic' | 'premium' | 'enterprise';
}

interface AdminFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const Register: React.FC<RegisterProps> = ({ onRegistrationSuccess, onSwitchToLogin }) => {
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    name: '',
    domain: '',
    subscriptionTier: 'basic'
  });

  const [adminData, setAdminData] = useState<AdminFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAdminInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateStep1 = () => {
    if (!companyData.name.trim()) {
      setError('Nome da empresa é obrigatório');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!adminData.name.trim() || !adminData.email.trim() || !adminData.password) {
      setError('Todos os campos são obrigatórios');
      return false;
    }

    if (adminData.password !== adminData.confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }

    if (adminData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminData.email)) {
      setError('Email inválido');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    setError(null);
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateStep2()) return;

    setIsLoading(true);

    try {
      const registrationData = {
        company: companyData,
        admin: {
          name: adminData.name,
          email: adminData.email,
          password: adminData.password
        }
      };

      const response = await fetch(buildUrl(API_CONFIG.ENDPOINTS.REGISTER), {
        method: 'POST',
        headers: createAuthHeaders(),
        body: JSON.stringify(registrationData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      if (result.success) {
        onRegistrationSuccess(result);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar Empresa</h1>
          <p className="text-gray-600 mt-2">
            {step === 1 ? 'Dados da empresa' : 'Dados do administrador'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex items-center mb-6">
          <div className={`w-4 h-4 rounded-full mr-2 ${step >= 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm mr-4">Empresa</span>
          <div className={`w-4 h-4 rounded-full mr-2 ${step >= 2 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm">Admin</span>
        </div>

        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa *
              </label>
              <input
                id="companyName"
                name="name"
                type="text"
                required
                value={companyData.name}
                onChange={handleCompanyInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Minha Empresa Contact Center"
              />
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domínio da Empresa (opcional)
              </label>
              <input
                id="domain"
                name="domain"
                type="text"
                value={companyData.domain}
                onChange={handleCompanyInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="minhaempresa.com.br"
              />
            </div>

            <div>
              <label htmlFor="subscriptionTier" className="block text-sm font-medium text-gray-700 mb-1">
                Plano de Assinatura
              </label>
              <select
                id="subscriptionTier"
                name="subscriptionTier"
                value={companyData.subscriptionTier}
                onChange={handleCompanyInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="basic">Básico (Gratuito)</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Próximo
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </button>

            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo *
              </label>
              <input
                id="adminName"
                name="name"
                type="text"
                required
                value={adminData.name}
                onChange={handleAdminInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="João Silva"
              />
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                id="adminEmail"
                name="email"
                type="email"
                required
                value={adminData.email}
                onChange={handleAdminInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="joao@minhaempresa.com.br"
              />
            </div>

            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Senha *
              </label>
              <div className="relative">
                <input
                  id="adminPassword"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminData.password}
                  onChange={handleAdminInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Senha *
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={adminData.confirmPassword}
                  onChange={handleAdminInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="Repita a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registrando...' : 'Registrar Empresa'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Fazer login
            </button>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Ao registrar, sua empresa receberá um endpoint único
            <br />
            para envio de relatórios de qualidade
          </p>
        </div>
      </div>
    </div>
  );
};