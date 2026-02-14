import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import EmailSettingsModal from '@/components/modals/email-settings-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Clock, Settings, Mail, FileText, Users, ExternalLink, Edit, Send, RefreshCw, Briefcase, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentAlert, ContractAlert } from '@shared/schema';
import { format } from 'date-fns';
import { formatDate } from '@/lib/utils';

export default function Alerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [contractSeverityFilter, setContractSeverityFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<DocumentAlert | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [activeTab, setActiveTab] = useState('documents');

  const { data: expiringDocuments, isLoading } = useQuery<DocumentAlert[]>({
    queryKey: ['/api/alerts/expiring-documents'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-documents?days=90', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const { data: emailSettings } = useQuery({
    queryKey: ['/api/email-settings'],
    queryFn: async () => {
      const response = await fetch('/api/email-settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch email settings');
      return response.json();
    },
  });

  const { data: expiringContracts = [], isLoading: isLoadingContracts } = useQuery<ContractAlert[]>({
    queryKey: ['/api/alerts/expiring-contracts'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-contracts?days=90', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch contract alerts');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const filteredAlerts = expiringDocuments?.filter(alert => {
    if (severityFilter === 'all') return true;
    return alert.severity === severityFilter;
  }) || [];

  const criticalAlerts = expiringDocuments?.filter(alert => alert.severity === 'critical') || [];
  const warningAlerts = expiringDocuments?.filter(alert => alert.severity === 'warning') || [];
  const infoAlerts = expiringDocuments?.filter(alert => alert.severity === 'info') || [];

  const filteredContractAlerts = expiringContracts.filter(alert => {
    if (contractSeverityFilter === 'all') return true;
    return alert.severity === contractSeverityFilter;
  });

  const expiredContracts = expiringContracts.filter(alert => alert.severity === 'expired');
  const criticalContracts = expiringContracts.filter(alert => alert.severity === 'critical');
  const warningContracts = expiringContracts.filter(alert => alert.severity === 'warning');
  const infoContracts = expiringContracts.filter(alert => alert.severity === 'info');

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'expired':
        return {
          color: 'bg-purple-50 dark:bg-purple-950/20 border-l-purple-600 dark:border-l-purple-400',
          badge: 'bg-purple-600 text-white',
          icon: XCircle,
          iconColor: 'text-purple-600 dark:text-purple-400',
          textColor: 'text-purple-700 dark:text-purple-300',
        };
      case 'critical':
        return {
          color: 'bg-red-50 dark:bg-red-950/20 border-l-red-500 dark:border-l-red-400',
          badge: 'bg-alert-red text-white',
          icon: AlertTriangle,
          iconColor: 'text-red-500 dark:text-red-400',
          textColor: 'text-red-700 dark:text-red-300',
        };
      case 'warning':
        return {
          color: 'bg-yellow-50 dark:bg-yellow-950/20 border-l-yellow-500 dark:border-l-yellow-400',
          badge: 'bg-warning-amber text-white',
          icon: Clock,
          iconColor: 'text-yellow-500 dark:text-yellow-400',
          textColor: 'text-yellow-700 dark:text-yellow-300',
        };
      case 'info':
        return {
          color: 'bg-blue-50 dark:bg-blue-950/20 border-l-blue-500 dark:border-l-blue-400',
          badge: 'bg-ocean-blue text-white',
          icon: Clock,
          iconColor: 'text-blue-500 dark:text-blue-400',
          textColor: 'text-blue-700 dark:text-blue-300',
        };
      default:
        return {
          color: 'bg-gray-50 dark:bg-gray-950/20 border-l-gray-500 dark:border-l-gray-400',
          badge: 'bg-gray-500 text-white',
          icon: Clock,
          iconColor: 'text-gray-500 dark:text-gray-400',
          textColor: 'text-gray-700 dark:text-gray-300',
        };
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Contact crew member mutation
  const contactCrewMutation = useMutation({
    mutationFn: async (data: { crewMemberId: string; subject: string; message: string }) => {
      const response = await fetch('/api/crew/contact', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Message sent successfully to crew member',
      });
      setIsContactModalOpen(false);
      setSelectedAlert(null);
      setEmailSubject('');
      setEmailMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Refresh alerts mutation
  const refreshAlertsMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/alerts/expiring-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/alerts/expiring-contracts'] });
      await queryClient.refetchQueries({ queryKey: ['/api/alerts/expiring-documents'] });
      await queryClient.refetchQueries({ queryKey: ['/api/alerts/expiring-contracts'] });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Alerts refreshed successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to refresh alerts',
        variant: 'destructive',
      });
    },
  });

  const handleContactCrew = (alert: DocumentAlert) => {
    setSelectedAlert(alert);
    setEmailSubject(`Document Expiry Alert - ${alert.document.type.toUpperCase()}`);
    setEmailMessage(`Dear ${alert.crewMember.firstName},

Your ${alert.document.type.toUpperCase()} certificate (${alert.document.documentNumber}) is due to expire on ${formatDate(alert.document.expiryDate)} - ${alert.daysUntilExpiry} days from now.

Please arrange for renewal at your earliest convenience to maintain compliance.

Best regards,
Maritime Operations Team`);
    setIsContactModalOpen(true);
  };

  const handleSendMessage = () => {
    if (!selectedAlert) return;

    contactCrewMutation.mutate({
      crewMemberId: selectedAlert.crewMember.id,
      subject: emailSubject,
      message: emailMessage,
    });
  };

  if (user?.role === 'crew') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-2xl font-semibold text-maritime-navy dark:text-white mb-2">Access Restricted</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Crew members can view their document alerts on the dashboard.
          </p>
          <Link href="/dashboard">
            <Button
              className="bg-maritime-navy hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || isLoadingContracts) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
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
          <h2 className="text-3xl font-bold text-maritime-navy dark:text-white mb-2" data-testid="alerts-title">
            Expiry Alerts & Notifications
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Monitor document expiry dates and configure notification settings
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => refreshAlertsMutation.mutate()}
            disabled={refreshAlertsMutation.isPending}
            data-testid="refresh-alerts-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshAlertsMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Dialog open={isEmailSettingsOpen} onOpenChange={setIsEmailSettingsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-maritime-navy hover:bg-blue-800" data-testid="email-settings-button">
                <Settings className="h-4 w-4 mr-2" />
                Email Settings
              </Button>
            </DialogTrigger>
            <EmailSettingsModal
              settings={emailSettings}
              onClose={() => setIsEmailSettingsOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      {/* Alert Summary */}
      {((expiringDocuments && expiringDocuments.length > 0) || expiringContracts.length > 0) && (
        <Alert className="border-warning-amber bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-600">
          <AlertTriangle className="h-4 w-4 text-warning-amber dark:text-yellow-400" />
          <AlertDescription className="text-gray-700 dark:text-gray-300">
            <span className="font-medium text-warning-amber dark:text-yellow-400">Active Alerts:</span>{' '}
            {expiringDocuments?.length || 0} document{(expiringDocuments?.length || 0) !== 1 ? 's' : ''} and {expiringContracts.length} contract{expiringContracts.length !== 1 ? 's' : ''} require attention.
            {(criticalAlerts.length > 0 || expiredContracts.length > 0 || criticalContracts.length > 0) &&
              ` ${criticalAlerts.length + expiredContracts.length + criticalContracts.length} critical/expired alerts need immediate action.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-ocean-blue dark:text-blue-400" />
              <span className="text-2xl font-bold text-maritime-navy dark:text-white" data-testid="total-alerts-count">
                {expiringDocuments?.length || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Critical (≤7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-alert-red rounded-full"></div>
              <span className="text-2xl font-bold text-maritime-navy dark:text-white" data-testid="critical-alerts-count">
                {criticalAlerts.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Warning (≤15 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-warning-amber rounded-full"></div>
              <span className="text-2xl font-bold text-maritime-navy dark:text-white" data-testid="warning-alerts-count">
                {warningAlerts.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Info (≤30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-ocean-blue rounded-full"></div>
              <span className="text-2xl font-bold text-maritime-navy dark:text-white" data-testid="info-alerts-count">
                {infoAlerts.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="documents-tab">
            <FileText className="h-4 w-4" />
            Documents ({expiringDocuments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2" data-testid="contracts-tab">
            <Briefcase className="h-4 w-4" />
            Contracts ({expiringContracts.length})
          </TabsTrigger>
        </TabsList>

        {/* Document Expiry Alerts Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-maritime-navy dark:text-white">Document Expiry Alerts</CardTitle>

                <div className="flex items-center space-x-4">
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-32" data-testid="severity-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No Alerts</h3>
                  <p className="text-gray-400 dark:text-gray-500">All documents are up to date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAlerts.map((alert) => {
                    const config = getSeverityConfig(alert.severity);
                    const Icon = config.icon;

                    return (
                      <div
                        key={alert.document.id}
                        className={`p-4 border-l-4 rounded-r ${config.color}`}
                        data-testid={`alert-item-${alert.document.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="bg-maritime-navy mt-1">
                              <AvatarFallback className="text-white font-medium">
                                {getInitials(alert.crewMember.firstName, alert.crewMember.lastName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className={`font-semibold ${config.textColor}`} data-testid="alert-crew-name">
                                  {alert.crewMember.firstName} {alert.crewMember.lastName}
                                </h4>
                                <Badge className={config.badge} data-testid="alert-severity">
                                  {alert.severity.toUpperCase()}
                                </Badge>
                              </div>

                              <div className="space-y-1">
                                <p className="text-gray-900 dark:text-gray-100 font-medium" data-testid="alert-document-info">
                                  {alert.document.type.toUpperCase()} Certificate - {alert.document.documentNumber}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300" data-testid="alert-expiry-info">
                                  Expires: {formatDate(alert.document.expiryDate)}
                                  ({alert.daysUntilExpiry} days remaining)
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Issued by: {alert.document.issuingAuthority}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Icon className={`h-5 w-5 ${config.iconColor}`} />
                            <div className="flex space-x-2">
                              <Link href={`/documents?highlight=${alert.crewMember.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-primary hover:text-primary-foreground"
                                  data-testid={`renew-document-${alert.document.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Renew
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleContactCrew(alert)}
                                data-testid={`contact-crew-${alert.document.id}`}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Contact
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contract Expiry Alerts Tab */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-maritime-navy dark:text-white">Contract Expiry Alerts</CardTitle>

                <div className="flex items-center space-x-4">
                  <Select value={contractSeverityFilter} onValueChange={setContractSeverityFilter}>
                    <SelectTrigger className="w-32" data-testid="contract-severity-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredContractAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No Contract Alerts</h3>
                  <p className="text-gray-400 dark:text-gray-500">All contracts are up to date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredContractAlerts.map((alert) => {
                    const config = getSeverityConfig(alert.severity);
                    const Icon = config.icon;

                    return (
                      <div
                        key={alert.contract.id}
                        className={`p-4 border-l-4 rounded-r ${config.color}`}
                        data-testid={`contract-alert-item-${alert.contract.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="bg-maritime-navy mt-1">
                              <AvatarFallback className="text-white font-medium">
                                {getInitials(alert.crewMember.firstName, alert.crewMember.lastName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className={`font-semibold ${config.textColor}`} data-testid="contract-alert-crew-name">
                                  {alert.crewMember.firstName} {alert.crewMember.lastName}
                                </h4>
                                <Badge className={config.badge} data-testid="contract-alert-severity">
                                  {alert.severity.toUpperCase()}
                                </Badge>
                              </div>

                              <div className="space-y-1">
                                <p className="text-gray-900 dark:text-gray-100 font-medium" data-testid="contract-alert-info">
                                  {alert.crewMember.rank} on {alert.vessel.name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-300" data-testid="contract-alert-expiry-info">
                                  {alert.severity === 'expired' ? 'Expired' : 'Expires'}: {formatDate(alert.contract.endDate)}
                                  ({alert.daysUntilExpiry <= 0 ? `Expired` : `${alert.daysUntilExpiry} days remaining`})
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Contract started: {formatDate(alert.contract.startDate)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Icon className={`h-5 w-5 ${config.iconColor}`} />
                            <div className="flex space-x-2">
                              <Link href={`/crew?highlight=${alert.crewMember.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-primary hover:text-primary-foreground"
                                  data-testid={`view-crew-${alert.contract.id}`}
                                >
                                  <Users className="h-4 w-4 mr-1" />
                                  View Crew
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Notification Status */}
      {emailSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-maritime-navy dark:text-white flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Email Notifications</span>
                <Badge className={emailSettings.enabled ? 'bg-compliance-green text-white' : 'bg-gray-500 text-white'}>
                  {emailSettings.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Reminder Schedule</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {emailSettings.reminderDays?.join(', ')} days before expiry
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Recipients</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {emailSettings.recipients?.join(', ')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Crew Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <span>Contact Crew Member</span>
            </DialogTitle>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <Avatar className="bg-maritime-navy">
                    <AvatarFallback className="text-white font-medium">
                      {getInitials(selectedAlert.crewMember.firstName, selectedAlert.crewMember.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedAlert.crewMember.firstName} {selectedAlert.crewMember.lastName}</p>
                    <p className="text-sm text-gray-600">{selectedAlert.crewMember.phoneNumber || 'No contact info'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                  data-testid="contact-subject-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-message">Message</Label>
                <Textarea
                  id="email-message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Your message to the crew member..."
                  rows={6}
                  data-testid="contact-message-input"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsContactModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={contactCrewMutation.isPending || !emailSubject || !emailMessage}
                  data-testid="send-contact-message-button"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {contactCrewMutation.isPending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
