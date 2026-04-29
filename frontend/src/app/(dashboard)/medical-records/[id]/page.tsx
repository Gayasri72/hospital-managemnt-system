"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { medicalApi } from '@/lib/api/medical';
import { MedicalRecord, Prescription } from '@/types/medical';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Calendar, User, Stethoscope, Pill, AlertCircle, FileText, ClipboardList, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';

const prescriptionSchema = z.object({
  medication_name: z.string().min(2, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration_days: z.coerce.number().min(1, "Duration must be at least 1 day"),
  instructions: z.string().optional(),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

export default function MedicalRecordDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingRx, setIsAddingRx] = useState(false);
  const [showRxForm, setShowRxForm] = useState(false);

  const canEdit = ['Doctor', 'Super Admin'].includes(user?.role || '');

  const fetchRecordData = async () => {
    try {
      const res = await medicalApi.getRecordById(id);
      if (res.success) setRecord(res.data);
    } catch (error) {
      console.error("Failed to fetch medical record", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchRecordData();
  }, [id]);

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema) as any,
    defaultValues: {
      medication_name: '',
      dosage: '',
      frequency: '',
      duration_days: 7,
      instructions: '',
    },
  });

  const onSubmitRx = async (data: PrescriptionFormValues) => {
    setIsAddingRx(true);
    try {
      const res = await medicalApi.addPrescription(id, data as any);
      if (res.success) {
        toast.success("Prescription added successfully");
        fetchRecordData();
        form.reset();
        setShowRxForm(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add prescription");
    } finally {
      setIsAddingRx(false);
    }
  };

  const handleDeleteRx = async (rxId: string) => {
    if (!confirm("Are you sure you want to remove this prescription?")) return;
    
    try {
      const res = await medicalApi.deletePrescription(id, rxId);
      if (res.success) {
        toast.success("Prescription removed");
        fetchRecordData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove prescription");
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading medical records...</div>;
  if (!record) return <div className="p-8 text-center text-red-500">Record not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/medical-records"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clinical Record</h1>
              <Badge variant="outline" className="font-mono text-xs text-slate-500">{record.record_id.substring(0, 8)}</Badge>
            </div>
            <p className="text-slate-500">Recorded on {new Date(record.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canEdit && (
            <Button variant="outline" className="w-full sm:w-auto border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" asChild>
              <Link href={`/medical-records/${id}/edit`}>Edit Notes</Link>
            </Button>
          )}
          <Button className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" /> Print Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Context Sidebar */}
        <Card className="col-span-1 shadow-sm border-t-4 border-t-blue-600 self-start">
          <CardHeader>
            <CardTitle className="text-lg">Consultation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-full text-slate-500"><User className="h-5 w-5"/></div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Patient</p>
                <p className="font-semibold text-slate-900">{record.appointment?.patient?.name || 'Unknown Patient'}</p>
                <Link href={`/patients/${record.patient_id}`} className="text-xs text-blue-600 hover:underline block mt-0.5">
                  View Patient History
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-full text-slate-500"><Stethoscope className="h-5 w-5"/></div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Doctor</p>
                <p className="font-semibold text-slate-900">Dr. {record.appointment?.doctor?.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{record.appointment?.doctor?.specialization}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-full text-slate-500"><Calendar className="h-5 w-5"/></div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Visit Date</p>
                <p className="font-medium text-slate-900">{new Date(record.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {record.follow_up_date && (
              <div className="pt-4 border-t mt-4 flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-full text-amber-600"><Clock className="h-5 w-5"/></div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Follow Up</p>
                  <p className="font-medium text-amber-700">{new Date(record.follow_up_date).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <FileText className="w-5 h-5 mr-2 text-blue-500" /> Clinical Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1"/> Symptoms & Complaints
                </h3>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                  {record.symptoms || "No symptoms recorded."}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <ClipboardList className="w-4 h-4 mr-1"/> Diagnosis
                </h3>
                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 text-slate-800 font-medium whitespace-pre-wrap">
                  {record.diagnosis || "Pending diagnosis."}
                </div>
              </div>

              {record.notes && (
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Additional Notes</h3>
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {record.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t-4 border-t-purple-500">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-lg text-slate-800">
                  <Pill className="w-5 h-5 mr-2 text-purple-500" /> Prescriptions
                </CardTitle>
                <CardDescription>Medications prescribed during this visit.</CardDescription>
              </div>
              {canEdit && !showRxForm && (
                <Button variant="outline" size="sm" onClick={() => setShowRxForm(true)}>
                  Add Medication
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              
              {showRxForm && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-6 relative">
                  <div className="absolute right-4 top-4">
                    <Button variant="ghost" size="sm" onClick={() => setShowRxForm(false)} className="h-8 text-slate-500">Cancel</Button>
                  </div>
                  <h4 className="font-semibold text-purple-900 mb-4">New Prescription</h4>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitRx)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="medication_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Medication Name</FormLabel>
                              <FormControl><Input placeholder="Amoxicillin 500mg" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dosage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dosage</FormLabel>
                              <FormControl><Input placeholder="1 tablet" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Once daily (OD)">Once daily (OD)</SelectItem>
                                  <SelectItem value="Twice daily (BD)">Twice daily (BD)</SelectItem>
                                  <SelectItem value="Three times daily (TDS)">Three times daily (TDS)</SelectItem>
                                  <SelectItem value="Four times daily (QID)">Four times daily (QID)</SelectItem>
                                  <SelectItem value="As needed (PRN)">As needed (PRN)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="duration_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (Days)</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="instructions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Special Instructions (Optional)</FormLabel>
                            <FormControl><Input placeholder="Take after meals" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={isAddingRx}>
                        {isAddingRx ? "Adding..." : "Add to Prescription List"}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}

              {record.prescriptions && record.prescriptions.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Medication & Dosage</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Duration</TableHead>
                        {canEdit && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.prescriptions.map((rx) => (
                        <TableRow key={rx.prescription_id}>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{rx.medication_name}</div>
                            <div className="text-sm text-slate-500">{rx.dosage}</div>
                            {rx.instructions && <div className="text-xs text-amber-600 mt-1 italic">{rx.instructions}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{rx.frequency}</TableCell>
                          <TableCell className="text-sm">{rx.duration_days} days</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteRx(rx.prescription_id)}>
                                Remove
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                  <Pill className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p>No medications prescribed.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
