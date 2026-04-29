"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sessionsApi } from '@/lib/api/sessions';
import { doctorsApi } from '@/lib/api/doctors';
import { branchesApi, Branch } from '@/lib/api/branches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const sessionSchema = z.object({
  doctor_id: z.string().min(1, "Doctor is required"),
  branch_id: z.string().min(1, "Branch is required"),
  session_date: z.string().min(1, "Session date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  slot_duration: z.coerce.number().min(5, "Minimum slot duration is 5 mins").max(60, "Maximum slot duration is 60 mins").optional(),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

export default function NewSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillDoctorId = searchParams.get('doctor_id');

  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [docsRes, branchRes] = await Promise.all([
          doctorsApi.getDoctors({ limit: 100 }),
          branchesApi.getBranches(),
        ]);
        if (docsRes.success) setDoctors(docsRes.data.items ?? docsRes.data);
        if (branchRes.success) setBranches(branchRes.data);
      } catch (error) {
        console.error("Failed to load form dependencies", error);
      }
    };
    fetchDependencies();
  }, []);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema) as any,
    defaultValues: {
      doctor_id: prefillDoctorId || '',
      branch_id: '',
      session_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '12:00',
      slot_duration: 15,
    },
  });

  async function onSubmit(data: SessionFormValues) {
    setIsLoading(true);
    try {
      const response = await sessionsApi.createSession(data);
      if (response.success) {
        toast.success("Session created successfully");
        router.push(`/sessions/${response.data.session_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create session");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sessions"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Session</h1>
          <p className="text-slate-500">Schedule a new doctor channeling session.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consulting Doctor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a doctor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doctors.map(doc => (
                          <SelectItem key={doc.doctor_id} value={doc.doctor_id}>
                            Dr. {doc.name} ({doc.specialization})
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
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location / Branch *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={branches.length === 0 ? "Loading branches..." : "Select a branch"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.branch_id} value={branch.branch_id}>
                            {branch.name}{branch.location ? ` — ${branch.location}` : ''}
                          </SelectItem>
                        ))}
                        {branches.length === 0 && (
                          <SelectItem value="_none" disabled>No branches found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="session_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="slot_duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slot Duration (minutes)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormDescription>How many minutes per patient appointment.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
