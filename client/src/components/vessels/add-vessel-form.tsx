import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const addVesselSchema = z.object({
  name: z.string().min(1, 'Vessel name is required'),
  type: z.string().min(1, 'Vessel type is required'),
  imoNumber: z.string().optional(),
  flag: z.string().min(1, 'Flag state is required'),
  status: z.enum(['harbour-mining', 'coastal-mining', 'world-wide', 'oil-field', 'line-up-mining']),
});

type AddVesselFormData = z.infer<typeof addVesselSchema>;

interface AddVesselFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const vesselTypes = [
  'AHT',
  'Bulk Carrier',
  'Container Ship',
  'Tanker',
  'Ferry',
  'Cruise Ship',
  'Cargo Ship',
  'OSV',
  'Research Vessel',
  'Naval Vessel',
  'Fishing Vessel',
  'General Cargo',
  'Passenger Ship',
  'Tugboat',
  'Trailing Suction Hopper Dredger (TSHD)',
  'Other'
];

const flagStates = [
  'Marshall Islands',
  'Liberia',
  'Panama',
  'Singapore',
  'Malta',
  'Bahamas',
  'Cyprus',
  'India',
  'Norway',
  'United Kingdom',
  'Greece',
  'Netherlands',
  'Germany',
  'United States',
  'St. Kitts & Nevis',
  'Other'
];

export default function AddVesselForm({ open, onOpenChange }: AddVesselFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddVesselFormData>({
    resolver: zodResolver(addVesselSchema),
    defaultValues: {
      name: '',
      type: '',
      imoNumber: '',
      flag: '',
      status: 'harbour-mining',
    },
  });

  const addVesselMutation = useMutation({
    mutationFn: async (data: AddVesselFormData) => {
      const response = await fetch('/api/vessels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
          'X-User-Id': 'admin-id',
          'X-User-Role': 'admin',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to add vessel');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Success',
        description: 'Vessel added successfully',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add vessel',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddVesselFormData) => {
    addVesselMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground">Add New Vessel</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter the details for the new vessel to add it to your fleet.
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
                    <FormLabel className="text-foreground">Vessel Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., MV Ocean Pioneer"
                        {...field}
                        data-testid="vessel-name-input"
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
                    <FormLabel className="text-foreground">Vessel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="vessel-type-select">
                          <SelectValue placeholder="Select vessel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vesselTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
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
                    <FormLabel className="text-foreground">IMO Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., IMO1234567"
                        {...field}
                        data-testid="imo-number-input"
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
                    <FormLabel className="text-foreground">Flag State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="flag-state-select">
                          <SelectValue placeholder="Select flag state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {flagStates.map((flag) => (
                          <SelectItem key={flag} value={flag}>
                            {flag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="vessel-status-select">
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
                  onClick={() => onOpenChange(false)}
                  data-testid="cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addVesselMutation.isPending}
                  data-testid="add-vessel-submit"
                  className="bg-primary hover:bg-primary/90"
                >
                  {addVesselMutation.isPending ? 'Adding...' : 'Add Vessel'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}