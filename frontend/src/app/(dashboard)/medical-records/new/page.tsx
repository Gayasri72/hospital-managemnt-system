"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { medicalApi } from '@/lib/api/medical';
import { appointmentsApi } from '@/lib/api/appointments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const recordSchema = z.object({
  appointment_id: z.string().min(1, "Appointment ID is required"),
  patient_id: z.string().min(1, "Patient ID is required"),
  doctor_id: z.string().min(1, "Doctor ID is required"),
  diagnosis: z.string().min(2, "Diagnosis is required"),
  symptoms: z.string().min(2, "Symptoms are required"),
  treatment_plan: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type RecordFormValues = z.infer<typeof recordSchema>;

export default function NewMedicalRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointment_id');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAppt, setIsFetchingAppt] = useState(!!appointmentId);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      appointment_id: appointmentId || '',
      patient_id: '',
      doctor_id: '',
      diagnosis: '',
      symptoms: '',
      treatment_plan: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchAppt = async () => {
      try {
        const response = await appointmentsApi.getAppointmentById(appointmentId!);
        if (response.success && response.data) {
          setAppointmentDetails(response.data);
          form.setValue('patient_id', response.data.patient_id);
          form.setValue('doctor_id', response.data.doctor_id);
        }
      } catch (error) {
        toast.error("Failed to load appointment details");
      } finally {
        setIsFetchingAppt(false);
      }
    };

    if (appointmentId) {
      fetchAppt();
    }
  }, [appointmentId, form]);

  async function onSubmit(data: RecordFormValues) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        symptoms: data.symptoms.split(',').map(s => s.trim()).filter(Boolean),
      };
      
      const response = await medicalApi.createRecord(payload as any);
      if (response.success) {
        toast.success("Medical record created successfully");
        router.push(`/medical-records/${response.data.record_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create medical record");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetchingAppt) {
    return <div className="p-8 text-center">Loading appointment data...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/medical-records"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Medical Record</h1>
          <p className="text-slate-500">Document clinical findings and diagnosis.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="appointment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment ID *</FormLabel>
                      <FormControl><Input placeholder="APP-XXX" {...field} readOnly={!!appointmentId} className={appointmentId ? "bg-slate-100" : ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {appointmentDetails && (
                  <div className="bg-blue-50 p-3 rounded-md text-sm">
                    <p className="font-semibold text-blue-900">Patient: {appointmentDetails.patient?.name}</p>
                    <p className="text-blue-700">Dr. {appointmentDetails.doctor?.name}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem className={appointmentId ? "hidden" : "block"}>
                      <FormLabel>Patient ID *</FormLabel>
                      <FormControl><Input placeholder="PAT-XXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="doctor_id"
                  render={({ field }) => (
                    <FormItem className={appointmentId ? "hidden" : "block"}>
                      <FormLabel>Doctor ID *</FormLabel>
                      <FormControl><Input placeholder="DOC-XXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Diagnosis *</FormLabel>
                    <FormControl><Input placeholder="e.g. Viral Pharyngitis" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symptoms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symptoms (comma separated) *</FormLabel>
                    <FormControl><Input placeholder="Fever, Sore throat, Cough" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="treatment_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Treatment Plan</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Rest, increased fluid intake..." className="resize-none h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Clinical Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Patient reported symptoms started 2 days ago..." className="resize-none h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Record"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
