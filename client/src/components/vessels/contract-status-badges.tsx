import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { getAuthHeaders } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { FileText, Download, Mail, Eye, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';

interface ContractStats {
  active: number;
  expiringSoon: number;
  expired: number;
}

interface ContractStatusBadgesProps {
  vesselId: string;
  vesselName: string;
  variant?: 'default' | 'sleek';
}

interface ContractWithCrew {
  id: string;
  crewMemberId: string;
  startDate: string;
  endDate: string;
  status: string;
  crewMember: {
    firstName: string;
    lastName: string;
    rank: string;
    email?: string;
  };
  filePath?: string | null;
  contractNumber?: string | null;
  contractType?: string | null;
}

export function ContractStatusBadges({ vesselId, vesselName, variant = 'default' }: ContractStatusBadgesProps) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [contractToEmail, setContractToEmail] = useState<ContractWithCrew | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['/api/vessels', vesselId, 'contract-stats'],
    queryFn: async () => {
      const response = await fetch(`/api/vessels/${vesselId}/contract-stats`, {
        headers: getAuthHeaders(),
      });
      return response.json() as Promise<ContractStats>;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ['/api/vessels', vesselId, 'contracts', selectedStatus],
    queryFn: async () => {
      const statusParam = selectedStatus ? `?status=${selectedStatus}` : '';
      const response = await fetch(`/api/vessels/${vesselId}/contracts${statusParam}`, {
        headers: getAuthHeaders(),
      });
      return response.json() as Promise<ContractWithCrew[]>;
    },
    enabled: !!selectedStatus,
  });

  if (!stats) return null;

  const handleStatusClick = (status: string) => {
    setSelectedStatus(status);
  };

  const closeDialog = () => {
    setSelectedStatus(null);
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active Contracts';
      case 'expiring':
        return 'Expiring Soon';
      case 'expired':
        return 'Expired Contracts';
      default:
        return 'Contracts';
    }
  };

  const getRemainingDays = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (variant === 'sleek') {
    return (
      <>
        <div className="flex items-center justify-between gap-1 w-full bg-slate-50/50 dark:bg-slate-900/10 rounded-xl p-1.5 border border-slate-200/40 dark:border-slate-800/40">
          {/* Valid */}
          <button
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-lg hover:bg-white dark:hover:bg-slate-950 hover:shadow-sm border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50 transition-all duration-300"
            onClick={() => handleStatusClick('active')}
          >
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter mb-0.5">Valid</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{stats.active}</span>
          </button>

          <div className="w-px h-6 bg-slate-200/60 dark:bg-slate-800/60 self-center" />

          {/* Due */}
          <button
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-lg hover:bg-white dark:hover:bg-slate-950 hover:shadow-sm border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50 transition-all duration-300 group"
            onClick={() => handleStatusClick('expiring')}
          >
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-tighter mb-0.5 whitespace-nowrap">Sign Off Due</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{stats.expiringSoon}</span>
          </button>

          <div className="w-px h-6 bg-slate-200/60 dark:bg-slate-800/60 self-center" />

          {/* Expired */}
          <button
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-lg hover:bg-white dark:hover:bg-slate-950 hover:shadow-sm border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50 transition-all duration-300"
            onClick={() => handleStatusClick('expired')}
          >
            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-tighter mb-0.5 whitespace-nowrap">Expired</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{stats.expired}</span>
          </button>
        </div>

        <ContractStatusDialogs
          selectedStatus={selectedStatus}
          closeDialog={closeDialog}
          getStatusTitle={getStatusTitle}
          vesselName={vesselName}
          contracts={contracts}
          getRemainingDays={getRemainingDays}
          setContractToEmail={setContractToEmail}
          setEmailRecipient={setEmailRecipient}
          setEmailDialogOpen={setEmailDialogOpen}
          toast={toast}
          emailDialogOpen={emailDialogOpen}
          contractToEmail={contractToEmail}
          emailRecipient={emailRecipient}
          setEmailRecipientState={setEmailRecipient}
          isSendingEmail={isSendingEmail}
          setIsSendingEmail={setIsSendingEmail}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Active Contracts */}
        <button
          className="w-full group transition-all"
          onClick={() => handleStatusClick('active')}
          data-testid={`active-contracts-${vesselId}`}
        >
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-600/70" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Valid</span>
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.active}</span>
          </div>
        </button>

        {/* Expiring Soon */}
        <button
          className="w-full group transition-all"
          onClick={() => handleStatusClick('expiring')}
          data-testid={`expiring-contracts-${vesselId}`}
        >
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-600/70 animate-pulse" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Sign Off Due</span>
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.expiringSoon}</span>
          </div>
        </button>

        {/* Expired */}
        <button
          className="w-full group transition-all"
          onClick={() => handleStatusClick('expired')}
          data-testid={`expired-contracts-${vesselId}`}
        >
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-600/70" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Contract Expired</span>
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.expired}</span>
          </div>
        </button>
      </div>

      <ContractStatusDialogs
        selectedStatus={selectedStatus}
        closeDialog={closeDialog}
        getStatusTitle={getStatusTitle}
        vesselName={vesselName}
        contracts={contracts}
        getRemainingDays={getRemainingDays}
        setContractToEmail={setContractToEmail}
        setEmailRecipient={setEmailRecipient}
        setEmailDialogOpen={setEmailDialogOpen}
        toast={toast}
        emailDialogOpen={emailDialogOpen}
        contractToEmail={contractToEmail}
        emailRecipient={emailRecipient}
        setEmailRecipientState={setEmailRecipient}
        isSendingEmail={isSendingEmail}
        setIsSendingEmail={setIsSendingEmail}
      />
    </>
  );
}

// Sub-component to clean up parent
function ContractStatusDialogs({
  selectedStatus,
  closeDialog,
  getStatusTitle,
  vesselName,
  contracts,
  getRemainingDays,
  setContractToEmail,
  setEmailRecipient,
  setEmailDialogOpen,
  toast,
  emailDialogOpen,
  contractToEmail,
  emailRecipient,
  setEmailRecipientState,
  isSendingEmail,
  setIsSendingEmail
}: any) {
  return (
    <>
      {/* Contract Details Dialog */}
      <Dialog open={!!selectedStatus} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[600px]" aria-describedby="contract-details-description">
          <DialogHeader>
            <DialogTitle>{getStatusTitle(selectedStatus || '')} - {vesselName}</DialogTitle>
            <DialogDescription id="contract-details-description">
              Contract details for this vessel
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            {contracts && contracts.length > 0 ? (
              <div className="space-y-3">
                {contracts.map((contract: any) => {
                  const remainingDays = getRemainingDays(contract.endDate);
                  const isExpiring = remainingDays <= 45 && remainingDays > 0;
                  const isExpired = remainingDays < 0;

                  return (
                    <div
                      key={contract.id}
                      className="p-4 border border-border rounded-lg bg-card"
                      data-testid={`contract-item-${contract.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-foreground">
                            {contract.crewMember.firstName} {contract.crewMember.lastName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {contract.crewMember.rank}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {isExpired
                              ? `Expired ${Math.abs(remainingDays)} days ago`
                              : isExpiring
                                ? `${remainingDays} days remaining`
                                : `${remainingDays} days remaining`
                            }
                          </p>
                          {isExpiring && (
                            <div className="flex items-center text-orange-600 dark:text-orange-400 text-xs mt-1">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <span>Start: {formatDate(contract.startDate)}</span>
                        <span>End: {formatDate(contract.endDate)}</span>
                      </div>

                      {contract.filePath ? (
                        <div className="flex flex-wrap gap-2 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex items-center gap-1.5"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/contracts/${contract.id}/view`, {
                                  headers: getAuthHeaders(),
                                });
                                if (!response.ok) throw new Error('Failed to view contract');
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, '_blank');
                                setTimeout(() => window.URL.revokeObjectURL(url), 100);
                              } catch (error) {
                                toast({ title: 'Error', description: 'Failed to open contract', variant: 'destructive' });
                              }
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex items-center gap-1.5"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/contracts/${contract.id}/download`, {
                                  headers: getAuthHeaders(),
                                });
                                if (!response.ok) throw new Error('Failed to download contract');
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Contract_${contract.crewMember.lastName}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                              } catch (error) {
                                toast({ title: 'Error', description: 'Failed to download contract', variant: 'destructive' });
                              }
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex items-center gap-1.5"
                            onClick={() => {
                              setContractToEmail(contract);
                              setEmailRecipient(contract.crewMember.email || '');
                              setEmailDialogOpen(true);
                            }}
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-3 border-t text-xs text-muted-foreground italic flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 opacity-50" />
                          No contract document uploaded
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No {selectedStatus} contracts found for this vessel.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Send Contract via Email
            </DialogTitle>
            <DialogDescription>
              {contractToEmail && `Send ${contractToEmail.contractType || 'SEA'} contract to ${contractToEmail.crewMember.firstName} ${contractToEmail.crewMember.lastName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                placeholder="email@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipientState(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!contractToEmail || !emailRecipient) return;
                setIsSendingEmail(true);
                try {
                  const response = await apiRequest('POST', '/api/email/send-contract', {
                    contractId: contractToEmail.id,
                    recipientEmail: emailRecipient
                  });
                  if (response.ok) {
                    toast({
                      title: "Email Sent",
                      description: `Contract successfully sent to ${emailRecipient}`,
                    });
                    setEmailDialogOpen(false);
                  } else {
                    throw new Error('Failed to send email');
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Could not send contract email. Please check SMTP settings.",
                    variant: "destructive",
                  });
                } finally {
                  setIsSendingEmail(false);
                }
              }}
              disabled={isSendingEmail || !emailRecipient}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}