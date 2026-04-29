"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sessionsApi } from '@/lib/api/sessions';
import { doctorsApi } from '@/lib/api/doctors';
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

export default function EditSessionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema) as any,
    defaultValues: {
      doctor_id: '',
      branch_id: '',
      session_date: '',
      start_time: '',
      end_time: '',
      slot_duration: 15,
    },
  });

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const docsRes = await doctorsApi.getDoctors({ limit: 100 });
        if (docsRes.success) setDoctors(docsRes.data.items || docsRes.data);
      } catch (error) {
        console.error("Failed to load dependencies", error);
      }
    };
    fetchDependencies();
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await sessionsApi.getSessionById(id);
        if (response.success && response.data) {
          const session = response.data;
          form.reset({
            doctor_id: session.doctor_id || '',
            branch_id: session.branch_id || '',
            session_date: session.session_date ? new Date(session.session_date).toISOString().split('T')[0] : '',
            start_time: session.start_time || '',
            end_time: session.end_time || '',
            slot_duration: session.slot_duration || 15,
          });
        }
      } catch (error) {
        toast.error("Failed to load session details");
        router.push('/sessions');
      } finally {
        setIsFetching(false);
      }
    };
    if (id) fetchSession();
  }, [id, form, router]);

  async function onSubmit(data: SessionFormValues) {
    setIsLoading(true);
    try {
      const response = await sessionsApi.updateSession(id, data);
      if (response.success) {
        toast.success("Session updated successfully");
        router.push(`/sessions/${id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update session");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return <div className="p-8 text-center">Loading session...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/sessions/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Session</h1>
          <p className="text-slate-500">Update channeling session details.</p>
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
                    <FormControl>
                      <Input placeholder="Enter Branch ID" {...field} />
                    </FormControl>
                    <FormDescription>In a production setup, this would be a dropdown of active hospital branches.</FormDescription>
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
                    <FormControl><Input type="number" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
                    <FormDescription>How many minutes per patient appointment.</FormDescription>
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
