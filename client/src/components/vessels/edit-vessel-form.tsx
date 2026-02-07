import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertVesselSchema, type Vessel } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Ship } from 'lucide-react';
import { z } from 'zod';

// Create edit schema 
const editVesselSchema = z.object({
  name: z.string().min(1, "Vessel name is required"),
  type: z.string().min(1, "Vessel type is required"),
  imoNumber: z.string().optional(),
  flag: z.string().min(1, "Flag state is required"),
  status: z.enum(["harbour-mining", "coastal-mining", "world-wide", "oil-field", "line-up-mining"]),
});
type EditVesselData = z.infer<typeof editVesselSchema>;

interface EditVesselFormProps {
  vessel: Vessel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditVesselForm({ vessel, open, onOpenChange }: EditVesselFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditVesselData>({
    resolver: zodResolver(editVesselSchema),
    defaultValues: {
      name: '',
      type: '',
      imoNumber: '',
      flag: '',
      status: 'harbour-mining',
    },
  });

  // Reset form when vessel changes
  useEffect(() => {
    if (vessel) {
      form.reset({
        name: vessel.name,
        type: vessel.type,
        imoNumber: vessel.imoNumber || '',
        flag: vessel.flag,
        status: vessel.status as "harbour-mining" | "coastal-mining" | "world-wide" | "oil-field" | "line-up-mining",
      });
    }
  }, [vessel, form]);

  const editVesselMutation = useMutation({
    mutationFn: async (data: EditVesselData) => {
      if (!vessel) throw new Error('No vessel to edit');
      const response = await apiRequest('PUT', `/api/vessels/${vessel.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Success',
        description: 'Vessel updated successfully',
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update vessel',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditVesselData) => {
    editVesselMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Edit Vessel
          </DialogTitle>
          <DialogDescription>
            Update the vessel details below and save your changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter vessel name"
                        {...field}
                        data-testid="edit-vessel-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-vessel-type">
                          <SelectValue placeholder="Select vessel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AHT">AHT</SelectItem>
                        <SelectItem value="Bulk Carrier">Bulk Carrier</SelectItem>
                        <SelectItem value="Container Ship">Container Ship</SelectItem>
                        <SelectItem value="Tanker">Tanker</SelectItem>
                        <SelectItem value="Ferry">Ferry</SelectItem>
                        <SelectItem value="Cruise Ship">Cruise Ship</SelectItem>
                        <SelectItem value="Cargo Ship">Cargo Ship</SelectItem>
                        <SelectItem value="OSV">OSV</SelectItem>
                        <SelectItem value="Research Vessel">Research Vessel</SelectItem>
                        <SelectItem value="Naval Vessel">Naval Vessel</SelectItem>
                        <SelectItem value="Fishing Vessel">Fishing Vessel</SelectItem>
                        <SelectItem value="General Cargo">General Cargo</SelectItem>
                        <SelectItem value="Passenger Ship">Passenger Ship</SelectItem>
                        <SelectItem value="Tugboat">Tugboat</SelectItem>
                        <SelectItem value="Trailing Suction Hopper Dredger (TSHD)">Trailing Suction Hopper Dredger (TSHD)</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imoNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IMO Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter IMO number (optional)"
                        {...field}
                        data-testid="edit-vessel-imo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="flag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flag State</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter flag state"
                        {...field}
                        data-testid="edit-vessel-flag"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-vessel-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="harbour-mining">Harbour Manning</SelectItem>
                        <SelectItem value="coastal-mining">Coastal Manning</SelectItem>
                        <SelectItem value="world-wide">World Wide (Foreign Going)</SelectItem>
                        <SelectItem value="oil-field">Oil Field</SelectItem>
                        <SelectItem value="line-up-mining">Laid Up</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={editVesselMutation.isPending}
                  data-testid="cancel-edit-vessel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editVesselMutation.isPending}
                  data-testid="save-vessel-changes"
                >
                  {editVesselMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}