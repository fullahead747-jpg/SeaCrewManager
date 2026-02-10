import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { OCRDocumentScanner } from './OCRDocumentScanner';
import { FileText, Loader2 } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';

interface AddContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddContractForm({ open, onOpenChange }: AddContractFormProps) {
  const { toast } = useToast();

  const [seafarerName, setSeafarerName] = useState('');
  const [seafarerRank, setSeafarerRank] = useState('');
  const [seafarerNationality, setSeafarerNationality] = useState('');
  const [seafarerDatePlaceOfBirth, setSeafarerDatePlaceOfBirth] = useState('');
  const [seafarerIndosNumber, setSeafarerIndosNumber] = useState('');
  const [seafarerPostalAddress, setSeafarerPostalAddress] = useState('');
  const [seafarerEmail, setSeafarerEmail] = useState('');
  const [seafarerMobile, setSeafarerMobile] = useState('');

  const [cdcNumber, setCdcNumber] = useState('');
  const [cdcPlaceOfIssue, setCdcPlaceOfIssue] = useState('');
  const [cdcIssueDate, setCdcIssueDate] = useState('');
  const [cdcExpiryDate, setCdcExpiryDate] = useState('');

  const [passportNumber, setPassportNumber] = useState('');
  const [passportPlaceOfIssue, setPassportPlaceOfIssue] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');

  const [nokName, setNokName] = useState('');
  const [nokRelationship, setNokRelationship] = useState('');
  const [nokEmail, setNokEmail] = useState('');
  const [nokTelephone, setNokTelephone] = useState('');
  const [nokPostalAddress, setNokPostalAddress] = useState('');

  const [cocGradeNo, setCocGradeNo] = useState('');
  const [cocPlaceOfIssue, setCocPlaceOfIssue] = useState('');
  const [cocIssueDate, setCocIssueDate] = useState('');
  const [cocExpiryDate, setCocExpiryDate] = useState('');

  const [medicalIssuingAuthority, setMedicalIssuingAuthority] = useState('');
  const [medicalApprovalNo, setMedicalApprovalNo] = useState('');
  const [medicalIssueDate, setMedicalIssueDate] = useState('');
  const [medicalExpiryDate, setMedicalExpiryDate] = useState('');

  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [scannedShipName, setScannedShipName] = useState('');

  const [contractStartDate, setContractStartDate] = useState('');
  const [contractDays, setContractDays] = useState<number | ''>('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [contractType, setContractType] = useState('SEA');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [appliedRecordId, setAppliedRecordId] = useState<string | null>(null);
  const [appliedRecordName, setAppliedRecordName] = useState<string | null>(null);

  // Fetch vessels for dropdown
  const { data: vessels } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  // Auto-match scanned ship name with vessel
  useEffect(() => {
    if (scannedShipName && vessels && vessels.length > 0) {
      const matchedVessel = vessels.find((v: any) =>
        v.name.toUpperCase().trim() === scannedShipName.toUpperCase().trim()
      );
      if (matchedVessel) {
        setSelectedVesselId(matchedVessel.id);
      }
    }
  }, [scannedShipName, vessels]);

  // Auto-calculate contract end date
  useEffect(() => {
    if (contractStartDate && contractDays && contractDays > 0) {
      const start = new Date(contractStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + contractDays);
      setContractEndDate(end.toISOString().split('T')[0]);
      setContractEndDate('');
    }
  }, [contractStartDate, contractDays]);

  const [cocSkipped, setCocSkipped] = useState(false);

  const resetForm = () => {
    setSeafarerName('');
    setSeafarerRank('');
    setSeafarerNationality('');
    setSeafarerDatePlaceOfBirth('');
    setSeafarerIndosNumber('');
    setSeafarerPostalAddress('');
    setSeafarerEmail('');
    setSeafarerMobile('');
    setCdcNumber('');
    setCdcPlaceOfIssue('');
    setCdcIssueDate('');
    setCdcExpiryDate('');
    setPassportNumber('');
    setPassportPlaceOfIssue('');
    setPassportIssueDate('');
    setPassportExpiryDate('');
    setNokName('');
    setNokRelationship('');
    setNokEmail('');
    setNokTelephone('');
    setNokPostalAddress('');
    setCocGradeNo('');
    setCocPlaceOfIssue('');
    setCocIssueDate('');
    setCocExpiryDate('');
    setMedicalIssuingAuthority('');
    setMedicalApprovalNo('');
    setMedicalIssueDate('');
    setMedicalExpiryDate('');
    setSelectedVesselId('');
    setScannedShipName('');
    setContractStartDate('');
    setContractDays('');
    setContractEndDate('');
    setContractNumber('');
    setContractType('SEA');
    setContractFile(null);
    setIsSaving(false);
    setIsUploading(false);
    setAppliedRecordId(null);
    setAppliedRecordId(null);
    setAppliedRecordName(null);
    setCocSkipped(false);
  };

  const handleOCRDataExtracted = (extractedData: any) => {
    // Auto-set the scanned file if available
    if (extractedData.scannedFile) {
      setContractFile(extractedData.scannedFile);
    }

    if (extractedData.seafarerName) {
      setSeafarerName(extractedData.seafarerName);
    }
    if (extractedData.seafarerRank || extractedData.capacityRankEmployed) {
      setSeafarerRank(extractedData.seafarerRank || extractedData.capacityRankEmployed);
    }
    if (extractedData.seafarerNationality) {
      setSeafarerNationality(extractedData.seafarerNationality);
    }
    if (extractedData.seafarerDatePlaceOfBirth) {
      setSeafarerDatePlaceOfBirth(extractedData.seafarerDatePlaceOfBirth);
    }
    if (extractedData.seafarerIndosNumber) {
      setSeafarerIndosNumber(extractedData.seafarerIndosNumber);
    }
    if (extractedData.seafarerPostalAddress) {
      setSeafarerPostalAddress(extractedData.seafarerPostalAddress);
    }
    if (extractedData.seafarerEmail) {
      setSeafarerEmail(extractedData.seafarerEmail);
    }
    if (extractedData.seafarerMobile) {
      setSeafarerMobile(extractedData.seafarerMobile);
    }
    if (extractedData.cdcNumber) {
      setCdcNumber(extractedData.cdcNumber);
    }
    if (extractedData.cdcPlaceOfIssue) {
      setCdcPlaceOfIssue(extractedData.cdcPlaceOfIssue);
    }
    if (extractedData.cdcIssueDate) {
      setCdcIssueDate(extractedData.cdcIssueDate);
    }
    if (extractedData.cdcExpiryDate) {
      setCdcExpiryDate(extractedData.cdcExpiryDate);
    }
    if (extractedData.passportNumber) {
      setPassportNumber(extractedData.passportNumber);
    }
    if (extractedData.passportPlaceOfIssue) {
      setPassportPlaceOfIssue(extractedData.passportPlaceOfIssue);
    }
    if (extractedData.passportIssueDate) {
      setPassportIssueDate(extractedData.passportIssueDate);
    }
    if (extractedData.passportExpiryDate) {
      setPassportExpiryDate(extractedData.passportExpiryDate);
    }
    if (extractedData.nokName) {
      setNokName(extractedData.nokName);
    }
    if (extractedData.nokRelationship) {
      setNokRelationship(extractedData.nokRelationship);
    }
    if (extractedData.nokEmail) {
      setNokEmail(extractedData.nokEmail);
    }
    if (extractedData.nokTelephone) {
      setNokTelephone(extractedData.nokTelephone);
    }
    if (extractedData.nokPostalAddress) {
      setNokPostalAddress(extractedData.nokPostalAddress);
    }
    if (extractedData.cocGradeNo) {
      setCocGradeNo(extractedData.cocGradeNo);
    }
    if (extractedData.cocPlaceOfIssue) {
      setCocPlaceOfIssue(extractedData.cocPlaceOfIssue);
    }
    if (extractedData.cocIssueDate) {
      setCocIssueDate(extractedData.cocIssueDate);
    }
    if (extractedData.cocExpiryDate) {
      setCocExpiryDate(extractedData.cocExpiryDate);
    }
    if (extractedData.medicalIssuingAuthority) {
      setMedicalIssuingAuthority(extractedData.medicalIssuingAuthority);
    }
    if (extractedData.medicalApprovalNo) {
      setMedicalApprovalNo(extractedData.medicalApprovalNo);
    }
    if (extractedData.medicalIssueDate) {
      setMedicalIssueDate(extractedData.medicalIssueDate);
    }
    if (extractedData.medicalExpiryDate) {
      setMedicalExpiryDate(extractedData.medicalExpiryDate);
    }
    if (extractedData.shipName) {
      setScannedShipName(extractedData.shipName);
    }
    if (extractedData.engagementPeriodMonths) {
      // Convert months to days (30 days per month)
      const days = extractedData.engagementPeriodMonths * 30;
      setContractDays(days);
    }

    if (extractedData.recordId) {
      setAppliedRecordId(extractedData.recordId);
      setAppliedRecordName(extractedData.displayName || extractedData.seafarerName || 'Unknown');
    }

    if (extractedData.displayName) {
      setContractNumber(extractedData.contractNumber || '');
    }

    toast({
      title: "Document Scanned Successfully",
      description: extractedData.displayName
        ? `Applied data from record: ${extractedData.displayName}`
        : "Seafarer details extracted from the document.",
    });
  };

  const handleSave = async () => {
    // Validation
    if (!seafarerName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter the seafarer name.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedVesselId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a vessel.',
        variant: 'destructive',
      });
      return;
    }

    if (!contractStartDate || !contractEndDate) {
      toast({
        title: 'Missing Information',
        description: 'Please enter contract start date and duration.',
        variant: 'destructive',
      });
      return;
    }

    // Validate Mandatory Documents (Passport, CDC, Medical)
    if (!passportNumber || !passportIssueDate || !passportExpiryDate) {
      toast({
        title: 'Missing Passport Details',
        description: 'Passport Number, Issue Date, and Expiry Date are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!cdcNumber || !cdcIssueDate || !cdcExpiryDate) {
      toast({
        title: 'Missing CDC Details',
        description: 'CDC Number, Issue Date, and Expiry Date are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!medicalApprovalNo || !medicalIssueDate || !medicalExpiryDate) {
      toast({
        title: 'Missing Medical Certificate',
        description: 'Medical Certificate No, Issue Date, and Expiry Date are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const parseDateToUTC = (dateStr: string) => {
      if (!dateStr) return new Date().toISOString();

      // Handle DD-MMM-YYYY (e.g. 04-JUL-2017)
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[-/](\w{3})[-/](\d{4})$/i);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const monthMap: Record<string, number> = {
          'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
          'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };
        const month = monthMap[ddmmyyyyMatch[2].toUpperCase()];
        const year = parseInt(ddmmyyyyMatch[3], 10);

        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, month, day)).toISOString();
        }
      }

      // Handle YYYY-MM-DD (e.g. 2017-07-04)
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(dateStr + 'T00:00:00.000Z').toISOString();
      }

      // Fallback: try parsing but ensure it's treated as UTC if it looks like a date only
      const d = new Date(dateStr);
      // If valid, use it as is (might be local, but best effort fallback)
      return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
    };

    try {
      // Parse name into first and last name
      const nameParts = seafarerName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

      // Parse date of birth from seafarerDatePlaceOfBirth (format: "09-MAR-1982 & ROHTAS-BIHAR")
      let dateOfBirth = new Date(Date.UTC(1990, 0, 1)); // Default date
      if (seafarerDatePlaceOfBirth) {
        const dobMatch = seafarerDatePlaceOfBirth.match(/(\d{1,2})[-/](\w{3})[-/](\d{4})/);
        if (dobMatch) {
          const day = parseInt(dobMatch[1], 10);
          const monthStr = dobMatch[2].toUpperCase();
          const year = parseInt(dobMatch[3], 10);

          const monthMap: Record<string, number> = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
          };

          const month = monthMap[monthStr];
          if (month !== undefined && !isNaN(day) && !isNaN(year)) {
            dateOfBirth = new Date(Date.UTC(year, month, day));
          }
        }
      }

      // Build emergency contact only if any NOK data is provided
      const hasEmergencyContact = nokName || nokRelationship || nokTelephone || nokEmail || nokPostalAddress;
      const emergencyContact = hasEmergencyContact ? {
        name: nokName || '',
        relationship: nokRelationship || '',
        phone: nokTelephone || '',
        email: nokEmail || '',
        postalAddress: nokPostalAddress || '',
      } : null;

      // Create crew member first
      const crewMemberData: Record<string, unknown> = {
        firstName,
        lastName,
        nationality: seafarerNationality || 'Unknown',
        dateOfBirth: dateOfBirth.toISOString(),
        rank: seafarerRank || cocGradeNo || 'Crew',
        currentVesselId: selectedVesselId,
        status: 'onBoard',
      };

      // Only add optional fields if they have values
      if (seafarerMobile) crewMemberData.phoneNumber = seafarerMobile;
      if (seafarerEmail) crewMemberData.email = seafarerEmail;
      if (emergencyContact) crewMemberData.emergencyContact = emergencyContact;

      let crewMember;
      try {
        const crewResponse = await apiRequest('POST', '/api/crew', crewMemberData);
        crewMember = await crewResponse.json();
      } catch (crewError) {
        throw new Error(`Failed to create crew member: ${crewError instanceof Error ? crewError.message : 'Unknown error'}`);
      }

      // Create documents (passport, CDC, COC, medical) if data is available
      const createDocument = async (type: string, docNumber: string, placeOfIssue: string, issueDate: string, expiryDate: string) => {
        if (docNumber && issueDate && expiryDate) {
          try {
            await apiRequest('POST', '/api/documents', {
              crewMemberId: crewMember.id,
              type,
              documentNumber: docNumber,
              issuingAuthority: placeOfIssue || '',
              issueDate: parseDateToUTC(issueDate),
              expiryDate: parseDateToUTC(expiryDate),
            });
          } catch (docError) {
            console.error(`Failed to create ${type} document:`, docError);
          }
        }
      };

      // Create all documents BEFORE contract to pass sign-on validation
      await createDocument('passport', passportNumber, passportPlaceOfIssue, passportIssueDate, passportExpiryDate);
      await createDocument('cdc', cdcNumber, cdcPlaceOfIssue, cdcIssueDate, cdcExpiryDate);

      if (!cocSkipped) {
        await createDocument('coc', cocGradeNo, cocPlaceOfIssue, cocIssueDate, cocExpiryDate);
      }

      await createDocument('medical', medicalApprovalNo, medicalIssuingAuthority, medicalIssueDate, medicalExpiryDate);

      // Create contract for the crew member
      let contractFilePath = null;
      if (contractFile) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', contractFile);
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData,
          });
          if (!uploadResponse.ok) throw new Error('Failed to upload contract document');
          const uploadData = await uploadResponse.json();
          contractFilePath = uploadData.filePath;
        } catch (uploadError) {
          console.error('Contract upload error:', uploadError);
          // Continue anyway, but notify
          toast({
            title: 'Upload Warning',
            description: 'Contract record created but file upload failed.',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      }

      const contractData = {
        crewMemberId: crewMember.id,
        vesselId: selectedVesselId,
        startDate: parseDateToUTC(contractStartDate),
        endDate: parseDateToUTC(contractEndDate),
        durationDays: typeof contractDays === 'number' ? contractDays : null,
        contractNumber: contractNumber || null,
        contractType: contractType || 'SEA',
        filePath: contractFilePath,
        status: 'active',
      };

      try {
        await apiRequest('POST', '/api/contracts', contractData);
      } catch (contractError) {
        throw new Error(`Crew member created, but failed to create contract: ${contractError instanceof Error ? contractError.message : 'Unknown error'}`);
      }

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      toast({
        title: 'Contract Created',
        description: `Contract for ${seafarerName} has been created successfully.`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving contract:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save contract. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-purple-600" />
            Add Contract
          </DialogTitle>
          <DialogDescription>
            Scan a document to extract seafarer details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <OCRDocumentScanner
              onDataExtracted={handleOCRDataExtracted}
              className="w-full"
              mode="seafarer"
            />
          </div>

          {appliedRecordId && appliedRecordName && (
            <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                Data applied from: <span className="font-medium ml-1">{appliedRecordName}</span>
                <span className="text-xs text-green-600 dark:text-green-400 ml-2">(ID: {appliedRecordId.slice(-8)})</span>
              </p>
            </div>
          )}

          <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
              Seafarer Details
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="seafarer-name">Name</Label>
                <Input
                  id="seafarer-name"
                  placeholder="Seafarer name"
                  value={seafarerName}
                  onChange={(e) => setSeafarerName(e.target.value)}
                  data-testid="seafarer-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-rank">Rank / Capacity Employed</Label>
                <Input
                  id="seafarer-rank"
                  placeholder="e.g., Master (NCV)"
                  value={seafarerRank}
                  onChange={(e) => setSeafarerRank(e.target.value)}
                  data-testid="seafarer-rank-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-nationality">Nationality</Label>
                <Input
                  id="seafarer-nationality"
                  placeholder="Nationality"
                  value={seafarerNationality}
                  onChange={(e) => setSeafarerNationality(e.target.value)}
                  data-testid="seafarer-nationality-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-dob-place">Date and Place of Birth</Label>
                <Input
                  id="seafarer-dob-place"
                  placeholder="e.g., 09-MAR-1982 & ROHTAS-BIHAR"
                  value={seafarerDatePlaceOfBirth}
                  onChange={(e) => setSeafarerDatePlaceOfBirth(e.target.value)}
                  data-testid="seafarer-dob-place-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-indos">INDOS No.</Label>
                <Input
                  id="seafarer-indos"
                  placeholder="INDOS number"
                  value={seafarerIndosNumber}
                  onChange={(e) => setSeafarerIndosNumber(e.target.value)}
                  data-testid="seafarer-indos-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-address">Postal Address</Label>
                <Input
                  id="seafarer-address"
                  placeholder="Full postal address"
                  value={seafarerPostalAddress}
                  onChange={(e) => setSeafarerPostalAddress(e.target.value)}
                  data-testid="seafarer-address-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-email">Email</Label>
                <Input
                  id="seafarer-email"
                  placeholder="Email address"
                  type="email"
                  value={seafarerEmail}
                  onChange={(e) => setSeafarerEmail(e.target.value)}
                  data-testid="seafarer-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seafarer-mobile">Mobile</Label>
                <Input
                  id="seafarer-mobile"
                  placeholder="Mobile number"
                  value={seafarerMobile}
                  onChange={(e) => setSeafarerMobile(e.target.value)}
                  data-testid="seafarer-mobile-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <h4 className="font-medium text-purple-900 dark:text-purple-100 flex items-center">
              <div className="w-2 h-2 bg-purple-600 rounded-full mr-2"></div>
              CDC No.
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cdc-number">CDC No.</Label>
                <Input
                  id="cdc-number"
                  placeholder="e.g., MUM 132798"
                  value={cdcNumber}
                  onChange={(e) => setCdcNumber(e.target.value)}
                  data-testid="cdc-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdc-place-of-issue">Place of Issue</Label>
                <Input
                  id="cdc-place-of-issue"
                  placeholder="e.g., MUMBAI"
                  value={cdcPlaceOfIssue}
                  onChange={(e) => setCdcPlaceOfIssue(e.target.value)}
                  data-testid="cdc-place-of-issue-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cdc-issue-date">Issue Date</Label>
                  <Input
                    id="cdc-issue-date"
                    placeholder="e.g., 28-MAR-2025"
                    value={cdcIssueDate}
                    onChange={(e) => setCdcIssueDate(e.target.value)}
                    data-testid="cdc-issue-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cdc-expiry-date">Expiry Date</Label>
                  <Input
                    id="cdc-expiry-date"
                    placeholder="e.g., 27-MAR-2035"
                    value={cdcExpiryDate}
                    onChange={(e) => setCdcExpiryDate(e.target.value)}
                    data-testid="cdc-expiry-date-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              Passport Details
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="passport-number">Passport No.</Label>
                <Input
                  id="passport-number"
                  placeholder="e.g., R2826385"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  data-testid="passport-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passport-place-of-issue">Place of Issue</Label>
                <Input
                  id="passport-place-of-issue"
                  placeholder="e.g., PATNA"
                  value={passportPlaceOfIssue}
                  onChange={(e) => setPassportPlaceOfIssue(e.target.value)}
                  data-testid="passport-place-of-issue-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="passport-issue-date">Issue Date</Label>
                  <Input
                    id="passport-issue-date"
                    placeholder="e.g., 04-JUL-2017"
                    value={passportIssueDate}
                    onChange={(e) => setPassportIssueDate(e.target.value)}
                    data-testid="passport-issue-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passport-expiry-date">Expiry Date</Label>
                  <Input
                    id="passport-expiry-date"
                    placeholder="e.g., 03-JUL-2027"
                    value={passportExpiryDate}
                    onChange={(e) => setPassportExpiryDate(e.target.value)}
                    data-testid="passport-expiry-date-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <h4 className="font-medium text-amber-900 dark:text-amber-100 flex items-center">
              <div className="w-2 h-2 bg-amber-600 rounded-full mr-2"></div>
              Next of Kin (NOK)
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nok-name">Name</Label>
                <Input
                  id="nok-name"
                  placeholder="e.g., MRS. BINITA KUMARI"
                  value={nokName}
                  onChange={(e) => setNokName(e.target.value)}
                  data-testid="nok-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nok-relationship">Relationship</Label>
                <Input
                  id="nok-relationship"
                  placeholder="e.g., WIFE"
                  value={nokRelationship}
                  onChange={(e) => setNokRelationship(e.target.value)}
                  data-testid="nok-relationship-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nok-email">Email</Label>
                <Input
                  id="nok-email"
                  placeholder="e.g., nok@email.com"
                  value={nokEmail}
                  onChange={(e) => setNokEmail(e.target.value)}
                  data-testid="nok-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nok-telephone">Telephone No.</Label>
                <Input
                  id="nok-telephone"
                  placeholder="e.g., 8538955893"
                  value={nokTelephone}
                  onChange={(e) => setNokTelephone(e.target.value)}
                  data-testid="nok-telephone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nok-postal-address">8a. NOK's Postal Address</Label>
                <Input
                  id="nok-postal-address"
                  placeholder="e.g., 102, MOURA ENCLAVE, VIJAY VIHAR COLONY"
                  value={nokPostalAddress}
                  onChange={(e) => setNokPostalAddress(e.target.value)}
                  data-testid="nok-postal-address-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
            <h4 className="font-medium text-indigo-900 dark:text-indigo-100 flex items-center">
              <div className="w-2 h-2 bg-indigo-600 rounded-full mr-2"></div>
              Details of Competency Certificates
            </h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-2">
                <Checkbox
                  id="coc-skipped"
                  checked={cocSkipped}
                  onCheckedChange={(checked) => setCocSkipped(checked === true)}
                />
                <Label htmlFor="coc-skipped" className="cursor-pointer font-normal text-indigo-900 dark:text-indigo-100">
                  NILL / Not Applicable (Crew member does not hold a COC)
                </Label>
              </div>

              <div className={cocSkipped ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                <div className="space-y-2">
                  <Label htmlFor="coc-grade-no">COC Grade / No</Label>
                  <Input
                    id="coc-grade-no"
                    placeholder="e.g., MASTER (F.G.) / 23-MUM-2024"
                    value={cocGradeNo}
                    onChange={(e) => setCocGradeNo(e.target.value)}
                    data-testid="coc-grade-no-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coc-place-of-issue">Place of Issue</Label>
                  <Input
                    id="coc-place-of-issue"
                    placeholder="e.g., MUMBAI"
                    value={cocPlaceOfIssue}
                    onChange={(e) => setCocPlaceOfIssue(e.target.value)}
                    data-testid="coc-place-of-issue-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="coc-issue-date">Date of Issue</Label>
                    <Input
                      id="coc-issue-date"
                      placeholder="e.g., 15-JAN-2024"
                      value={cocIssueDate}
                      onChange={(e) => setCocIssueDate(e.target.value)}
                      data-testid="coc-issue-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coc-expiry-date">Date of Expiry</Label>
                    <Input
                      id="coc-expiry-date"
                      placeholder="e.g., 14-JAN-2029"
                      value={cocExpiryDate}
                      onChange={(e) => setCocExpiryDate(e.target.value)}
                      data-testid="coc-expiry-date-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
            <h4 className="font-medium text-rose-900 dark:text-rose-100 flex items-center">
              <div className="w-2 h-2 bg-rose-600 rounded-full mr-2"></div>
              Details of Medical Certificate
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="medical-issuing-authority">Issuing Authority</Label>
                <Input
                  id="medical-issuing-authority"
                  placeholder="e.g., DR. DIWAKAR TIWARI (GLOBUS MEDICARE)"
                  value={medicalIssuingAuthority}
                  onChange={(e) => setMedicalIssuingAuthority(e.target.value)}
                  data-testid="medical-issuing-authority-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical-approval-no">Approval No</Label>
                <Input
                  id="medical-approval-no"
                  placeholder="e.g., MAH/NM/22/2015"
                  value={medicalApprovalNo}
                  onChange={(e) => setMedicalApprovalNo(e.target.value)}
                  data-testid="medical-approval-no-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="medical-issue-date">Issue Date</Label>
                  <Input
                    id="medical-issue-date"
                    placeholder="e.g., 15-JAN-2025"
                    value={medicalIssueDate}
                    onChange={(e) => setMedicalIssueDate(e.target.value)}
                    data-testid="medical-issue-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical-expiry-date">Expiry Date</Label>
                  <Input
                    id="medical-expiry-date"
                    placeholder="e.g., 14-JAN-2027"
                    value={medicalExpiryDate}
                    onChange={(e) => setMedicalExpiryDate(e.target.value)}
                    data-testid="medical-expiry-date-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
            <h4 className="font-medium text-cyan-900 dark:text-cyan-100 flex items-center">
              <div className="w-2 h-2 bg-cyan-600 rounded-full mr-2"></div>
              Details of Ship
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ship-name">Name</Label>
                <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                  <SelectTrigger id="ship-name" data-testid="ship-name-select">
                    <SelectValue placeholder="Select a vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels && vessels.map((vessel: any) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scannedShipName && !selectedVesselId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Scanned: "{scannedShipName}" - No matching vessel found
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
            <h4 className="font-medium text-teal-900 dark:text-teal-100 flex items-center">
              <div className="w-2 h-2 bg-teal-600 rounded-full mr-2"></div>
              Contract Information
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="contract-start-date">Contract Start Date</Label>
                <Input
                  id="contract-start-date"
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  data-testid="contract-start-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-days">Number of Contract Days</Label>
                <Input
                  id="contract-days"
                  type="number"
                  min="1"
                  placeholder="e.g., 180"
                  value={contractDays}
                  onChange={(e) => setContractDays(e.target.value ? parseInt(e.target.value) : '')}
                  data-testid="contract-days-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-end-date">Contract End Date</Label>
                <Input
                  id="contract-end-date"
                  type="date"
                  value={contractEndDate}
                  readOnly
                  className="bg-gray-100 dark:bg-gray-800"
                  data-testid="contract-end-date-input"
                />
                <p className="text-xs text-teal-600 dark:text-teal-400">
                  Auto-calculated based on start date and number of days
                </p>
              </div>

              {contractFile ? (
                <div className="space-y-2">
                  <Label>Contract Document</Label>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            {contractFile.name}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Auto-fetched from scanned document
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setContractFile(null)}
                        className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="contract-file">Upload Contract Document (Manual)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="contract-file"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setContractFile(file);
                      }}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only needed if you entered data manually without scanning
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              data-testid="cancel-contract-btn"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isUploading}
              data-testid="save-contract-btn"
            >
              {isSaving || isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

