"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { medicalApi } from '@/lib/api/medical';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const recordSchema = z.object({
  diagnosis: z.string().min(2, "Diagnosis is required"),
  symptoms: z.string().min(2, "Symptoms are required"),
  treatment_plan: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type RecordFormValues = z.infer<typeof recordSchema>;

export default function EditMedicalRecordPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema) as any,
    defaultValues: {
      diagnosis: '',
      symptoms: '',
      treatment_plan: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const response = await medicalApi.getRecordById(id);
        if (response.success && response.data) {
          const record = response.data;
          form.reset({
            diagnosis: record.diagnosis || '',
            symptoms: Array.isArray(record.symptoms) ? record.symptoms.join(', ') : '',
            treatment_plan: record.treatment_plan || '',
            notes: record.notes || '',
          });
        }
      } catch (error) {
        toast.error("Failed to load record details");
        router.push('/medical-records');
      } finally {
        setIsFetching(false);
      }
    };
    if (id) fetchRecord();
  }, [id, form, router]);

  async function onSubmit(data: RecordFormValues) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        symptoms: data.symptoms.split(',').map(s => s.trim()).filter(Boolean),
      };
      
      const response = await medicalApi.updateRecord(id, payload as any);
      if (response.success) {
        toast.success("Medical record updated successfully");
        router.push(`/medical-records/${id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update medical record");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return <div className="p-8 text-center">Loading record data...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/medical-records/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Medical Record</h1>
          <p className="text-slate-500">Update clinical findings and diagnosis.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
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
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
