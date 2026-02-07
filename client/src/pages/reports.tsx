import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  Ship,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { formatDate, cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

interface VesselData {
  name: string;
  assigned: number;
  capacity: number;
  utilization: number;
  status: string;
}

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState('overview');

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: expiringDocuments, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/alerts/expiring-documents'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-documents?days=90', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch expiring documents');
      return response.json();
    },
  });

  const { data: crewMembers, isLoading: crewLoading } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
  });

  const { data: vessels, isLoading: vesselsLoading } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/contracts'],
    queryFn: async () => {
      const response = await fetch('/api/contracts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
  });

  const { data: complianceKPIs, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/reports/compliance-kpis'],
    queryFn: async () => {
      const response = await fetch('/api/reports/compliance-kpis', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch compliance KPIs');
      return response.json();
    },
  });

  const { data: vesselRiskScores, isLoading: riskLoading } = useQuery({
    queryKey: ['/api/reports/vessel-risk-scores'],
    queryFn: async () => {
      const response = await fetch('/api/reports/vessel-risk-scores', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessel risk scores');
      return response.json();
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            Reports are only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = statsLoading || documentsLoading || crewLoading || vesselsLoading || contractsLoading || kpisLoading || riskLoading;

  const generateComplianceReport = () => {
    if (!expiringDocuments || !crewMembers) return [];

    const criticalAlerts = expiringDocuments.filter((alert: any) => alert.severity === 'critical');
    const warningAlerts = expiringDocuments.filter((alert: any) => alert.severity === 'warning');
    const infoAlerts = expiringDocuments.filter((alert: any) => alert.severity === 'info');

    return [
      { level: 'Critical', count: criticalAlerts.length, color: 'bg-red-500' },
      { level: 'Warning', count: warningAlerts.length, color: 'bg-yellow-500' },
      { level: 'Info', count: infoAlerts.length, color: 'bg-blue-500' },
    ];
  };

  const generateCrewReport = () => {
    if (!crewMembers) return [];

    const statusCounts = crewMembers.reduce((acc: any, member: any) => {
      acc[member.status] = (acc[member.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: Math.round((count as number / crewMembers.length) * 100),
    }));
  };

  const generateVesselUtilization = (): VesselData[] => {
    if (!vessels || !crewMembers) return [];

    return vessels.map((vessel: any) => {
      const assignedCrew = crewMembers.filter((member: any) => member.currentVesselId === vessel.id);
      const capacity = vessel.crewCapacity || 20; // Default capacity
      const utilization = Math.round((assignedCrew.length / capacity) * 100);

      return {
        name: vessel.name,
        assigned: assignedCrew.length,
        capacity,
        utilization,
        status: vessel.status,
      };
    });
  };

  const exportToCSV = () => {
    try {
      let csvContent = '';
      let filename = '';

      switch (reportType) {
        case 'overview':
          csvContent = generateOverviewCSV();
          filename = 'overview-report.csv';
          break;
        case 'compliance':
          csvContent = generateComplianceCSV();
          filename = 'compliance-report.csv';
          break;
        case 'crew':
          csvContent = generateCrewCSV();
          filename = 'crew-analysis-report.csv';
          break;
        case 'vessels':
          csvContent = generateVesselCSV();
          filename = 'vessel-utilization-report.csv';
          break;
        default:
          csvContent = generateOverviewCSV();
          filename = 'report.csv';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Export Successful',
        description: `${filename} has been downloaded`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Unable to export report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const generateOverviewCSV = () => {
    const headers = ['Metric', 'Value', 'Trend'];
    const rows = [
      ['Active Crew', dashboardStats?.activeCrew || 0, '+5% vs last month'],
      ['Active Vessels', dashboardStats?.activeVessels || 0, 'Steady'],
      ['Pending Actions', dashboardStats?.pendingActions || 0, '-12% vs last week'],
      ['Compliance Rate', `${dashboardStats?.complianceRate || 0}%`, 'Good'],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const generateComplianceCSV = () => {
    if (!expiringDocuments) return 'No compliance data available';

    const headers = ['Crew Member', 'Document Type', 'Document Number', 'Expiry Date', 'Days Remaining', 'Severity'];
    const rows = expiringDocuments.map((alert: any) => [
      `${alert.crewMember.firstName} ${alert.crewMember.lastName}`,
      alert.document.type.toUpperCase(),
      alert.document.documentNumber,
      format(new Date(alert.document.expiryDate), 'yyyy-MM-dd'),
      alert.daysUntilExpiry,
      alert.severity.toUpperCase(),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const generateCrewCSV = () => {
    if (!crewMembers) return 'No crew data available';

    const headers = ['Name', 'Rank', 'Status', 'Nationality', 'Current Vessel'];
    const rows = crewMembers.map((member: any) => [
      `${member.firstName} ${member.lastName}`,
      member.rank,
      member.status,
      member.nationality,
      vessels?.find((v: any) => v.id === member.currentVesselId)?.name || 'Unassigned',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const generateVesselCSV = () => {
    const headers = ['Vessel Name', 'Crew Assigned', 'Capacity', 'Utilization %', 'Status'];
    const rows = vesselData.map((vessel: VesselData) => [
      vessel.name,
      vessel.assigned,
      vessel.capacity,
      vessel.utilization,
      vessel.status,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const complianceData = generateComplianceReport();
  const crewData = generateCrewReport();
  const vesselData = generateVesselUtilization();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="reports-title">
            Reports & Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive insights into fleet operations and crew management
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-48" data-testid="report-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="compliance">Compliance List</SelectItem>
              <SelectItem value="compliance-analysis">Compliance Analysis</SelectItem>
              <SelectItem value="crew">Crew Analysis</SelectItem>
              <SelectItem value="vessels">Vessel Utilization</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32" data-testid="date-range-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="365">1 Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={exportToCSV}
            disabled={isLoading}
            data-testid="export-report-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {reportType === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Active Crew
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground" data-testid="active-crew-stat">
                  {dashboardStats?.activeCrew || 0}
                </div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+5% vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Ship className="h-4 w-4 mr-2" />
                  Active Vessels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground" data-testid="active-vessels-stat">
                  {dashboardStats?.activeVessels || 0}
                </div>
                <div className="flex items-center mt-2">
                  <Activity className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-sm text-muted-foreground">Steady</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Pending Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground" data-testid="pending-actions-stat">
                  {dashboardStats?.pendingActions || 0}
                </div>
                <div className="flex items-center mt-2">
                  <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">-12% vs last week</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Compliance Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground" data-testid="compliance-rate-stat">
                  {dashboardStats?.complianceRate || 0}%
                </div>
                <Progress value={dashboardStats?.complianceRate || 0} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Document Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complianceData.map((item) => (
                    <div key={item.level} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                        <span className="text-sm font-medium text-foreground">{item.level}</span>
                      </div>
                      <Badge variant="outline">{item.count} alerts</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Crew Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {crewData.map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{item.status}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">{item.count as React.ReactNode}</span>
                        <Badge variant="outline">{item.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Vessel Utilization Report */}
      {reportType === 'vessels' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Vessel Utilization Report</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel Name</TableHead>
                  <TableHead>Crew Assigned</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vesselData.map((vessel: VesselData) => (
                  <TableRow key={vessel.name}>
                    <TableCell className="font-medium">{vessel.name}</TableCell>
                    <TableCell>{vessel.assigned}</TableCell>
                    <TableCell>{vessel.capacity}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Progress value={vessel.utilization} className="w-16" />
                        <span className="text-sm">{vessel.utilization}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={vessel.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
                      >
                        {vessel.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Compliance Analysis Report */}
      {reportType === 'compliance-analysis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Renewal Success</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{complianceKPIs?.renewalSuccessRate}%</div>
                <p className="text-xs text-blue-600/80 mt-1">Renewed before 30-day threshold</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Avg. Action Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{complianceKPIs?.avgDaysToAction} Days</div>
                <p className="text-xs text-amber-600/80 mt-1">From alert to document upload</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background border-red-100 dark:border-red-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">Active Expiries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-700 dark:text-red-300">{complianceKPIs?.activeComplaints}</div>
                <p className="text-xs text-red-600/80 mt-1">Documents currently expired</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background border-purple-100 dark:border-purple-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Emergency Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{complianceKPIs?.emergencyChanges}</div>
                <p className="text-xs text-purple-600/80 mt-1">Last 90 days due to compliance</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Vessel Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vesselRiskScores?.map((risk: any) => (
                      <TableRow key={risk.vesselId}>
                        <TableCell className="font-medium">{risk.vesselName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={risk.riskScore}
                              className={cn(
                                "h-2 w-24",
                                risk.riskScore > 50 ? "[&>div]:bg-red-500" :
                                  risk.riskScore > 20 ? "[&>div]:bg-amber-500" :
                                    "[&>div]:bg-green-500"
                              )}
                            />
                            <span className="text-xs font-bold">{risk.riskScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={risk.status === 'high' ? 'destructive' : risk.status === 'medium' ? 'warning' : 'outline'}>
                            {risk.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Compliance Trend (Mock)
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <BarChart3 className="h-16 w-16 text-muted/30 mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Compliance rate has improved by 4% <br /> since the implementation of Phase 2.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Crew Analysis Report */}
      {reportType === 'crew' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Crew Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-foreground">Total Crew Members</span>
                  <span className="font-semibold text-foreground">{crewMembers?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Crew On Board</span>
                  <span className="font-semibold text-green-600">
                    {crewMembers?.filter((c: any) => c.status === 'onBoard').length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Crew On Shore</span>
                  <span className="font-semibold text-yellow-600">
                    {crewMembers?.filter((c: any) => c.status === 'onShore').length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Contract Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-foreground">Total Contracts</span>
                  <span className="font-semibold text-foreground">{contracts?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Active Contracts</span>
                  <span className="font-semibold text-green-600">
                    {contracts?.filter((c: any) => c.status === 'active').length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Completed</span>
                  <span className="font-semibold text-blue-600">
                    {contracts?.filter((c: any) => c.status === 'completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Terminated</span>
                  <span className="font-semibold text-red-600">
                    {contracts?.filter((c: any) => c.status === 'terminated').length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}