import React, { useState, useEffect } from 'react';
import { DollarSign, Shield, Users, TrendingUp, AlertTriangle, CheckCircle, PhoneCall, Target } from 'lucide-react';
import StatCard from './StatCard';

interface DebtCollectionMetrics {
  totalCalls: number;
  promiseToPayRate: number;
  complianceRate: number;
  paymentDiscussionRate: number;
  objectionHandlingRate: number;
  empathyScore: number;
  rightPartyContactRate: number;
  averageRecoveryAmount: number;
  violationCount: number;
  customerHardshipRate: number;
}

interface DebtCollectionDashboardProps {
  companyId: string;
  dateRange?: string;
  refreshTrigger?: number;
}

const DebtCollectionDashboard: React.FC<DebtCollectionDashboardProps> = ({ 
  companyId, 
  dateRange = '7d',
  refreshTrigger = 0 
}) => {
  const [metrics, setMetrics] = useState<DebtCollectionMetrics>({
    totalCalls: 0,
    promiseToPayRate: 0,
    complianceRate: 100,
    paymentDiscussionRate: 0,
    objectionHandlingRate: 0,
    empathyScore: 0,
    rightPartyContactRate: 0,
    averageRecoveryAmount: 0,
    violationCount: 0,
    customerHardshipRate: 0
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebtCollectionMetrics = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('No access token found');
          return;
        }

        const response = await fetch(`http://localhost:3005/api/companies/${companyId}/debt-collection-metrics?period=${dateRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        } else {
          console.error('Failed to fetch debt collection metrics');
        }
      } catch (error) {
        console.error('Error fetching debt collection metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDebtCollectionMetrics();
  }, [companyId, dateRange, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Debt Collection Performance</h2>
        <p className="text-gray-600">Specialized metrics for debt collection operations focusing on compliance, recovery rates, and customer handling</p>
      </div>

      {/* Top Priority KPIs Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Promise-to-Pay Rate"
          value={`${metrics.promiseToPayRate.toFixed(1)}%`}
          icon={Target}
          className="bg-gradient-to-br from-green-500/10 to-green-600/20 border-green-200"
          subtitle={`Target: 15-25% (Industry avg: 10-12%)`}
        />
        <StatCard
          title="Compliance Rate"
          value={`${metrics.complianceRate.toFixed(1)}%`}
          icon={Shield}
          className={`bg-gradient-to-br ${metrics.complianceRate >= 99 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-red-500/10 to-red-600/20 border-red-200'}`}
          subtitle={`Must be 100% (FDCPA requirement)`}
        />
        <StatCard
          title="Payment Discussion Rate"
          value={`${metrics.paymentDiscussionRate.toFixed(1)}%`}
          icon={DollarSign}
          className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 border-blue-200"
          subtitle={`Target: 80%+ on appropriate calls`}
        />
        <StatCard
          title="Right Party Contact"
          value={`${metrics.rightPartyContactRate.toFixed(1)}%`}
          icon={CheckCircle}
          className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 border-purple-200"
          subtitle={`Must approach 100% for compliance`}
        />
      </div>

      {/* Top Priority KPIs Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Objection Handling"
          value={`${metrics.objectionHandlingRate.toFixed(1)}%`}
          icon={Users}
          className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 border-indigo-200"
          subtitle={`Elite performers: 60% success rate`}
        />
        <StatCard
          title="Empathy Score"
          value={`${metrics.empathyScore.toFixed(1)}/10`}
          icon={TrendingUp}
          className="bg-gradient-to-br from-teal-500/10 to-teal-600/20 border-teal-200"
          subtitle={`Correlates with 15-25% better performance`}
        />
        <StatCard
          title="FDCPA Violations"
          value={metrics.violationCount.toString()}
          icon={AlertTriangle}
          className={`bg-gradient-to-br ${metrics.violationCount === 0 ? 'from-green-500/10 to-green-600/20 border-green-200' : 'from-red-500/10 to-red-600/20 border-red-200'}`}
          subtitle={`$1,000 per violation fine`}
        />
        <StatCard
          title="Customer Hardship Rate"
          value={`${metrics.customerHardshipRate.toFixed(1)}%`}
          icon={PhoneCall}
          className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 border-orange-200"
          subtitle={`Requires accommodation tracking`}
        />
      </div>

      {/* Performance Summary Section */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Performance Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Collection Efficiency */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Target className="w-4 h-4 mr-2 text-green-600" />
              Collection Efficiency
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Calls</span>
                <span className="font-medium">{metrics.totalCalls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg Recovery Amount</span>
                <span className="font-medium">${metrics.averageRecoveryAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className={`font-medium ${metrics.promiseToPayRate >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {metrics.promiseToPayRate >= 15 ? 'Above Target' : 'Below Target'}
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-blue-600" />
              Compliance Status
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Violation Count</span>
                <span className={`font-medium ${metrics.violationCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.violationCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Compliance Rate</span>
                <span className={`font-medium ${metrics.complianceRate >= 99 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.complianceRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Status</span>
                <span className={`font-medium ${metrics.complianceRate >= 99 && metrics.violationCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.complianceRate >= 99 && metrics.violationCount === 0 ? 'Compliant' : 'At Risk'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Relations */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              <Users className="w-4 h-4 mr-2 text-purple-600" />
              Customer Relations
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Empathy Score</span>
                <span className={`font-medium ${metrics.empathyScore >= 7 ? 'text-green-600' : metrics.empathyScore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {metrics.empathyScore.toFixed(1)}/10
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Hardship Recognition</span>
                <span className="font-medium">{metrics.customerHardshipRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Objection Handling</span>
                <span className={`font-medium ${metrics.objectionHandlingRate >= 60 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {metrics.objectionHandlingRate >= 60 ? 'Elite Level' : 'Needs Improvement'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Practices Indicators */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt Collection Best Practices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Regulatory Compliance</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.complianceRate >= 99 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                Mini-Miranda disclosure (100% required)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.rightPartyContactRate >= 95 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Right party verification ({metrics.rightPartyContactRate.toFixed(1)}%)
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.violationCount === 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                No prohibited language violations
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Performance Excellence</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.promiseToPayRate >= 15 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Promise-to-pay above industry average
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.paymentDiscussionRate >= 80 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Payment discussion on appropriate calls
              </li>
              <li className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${metrics.empathyScore >= 7 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                High empathy scores for better outcomes
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebtCollectionDashboard;