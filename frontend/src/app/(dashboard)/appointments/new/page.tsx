"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { appointmentsApi } from '@/lib/api/appointments';
import { patientsApi } from '@/lib/api/patients';
import { sessionsApi } from '@/lib/api/sessions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';

const appointmentSchema = z.object({
  patient_id: z.string().min(1, "Patient is required"),
  session_id: z.string().min(1, "Session is required"),
  slot_id: z.string().optional(),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export default function NewAppointmentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [searchPatient, setSearchPatient] = useState('');
  const debouncedSearch = useDebounce(searchPatient, 500);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patient_id: '',
      session_id: '',
      slot_id: '',
      notes: '',
    },
  });

  const selectedSessionId = form.watch('session_id');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await patientsApi.getPatients({ search: debouncedSearch, limit: 20 });
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setPatients(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch patients", error);
      }
    };
    fetchPatients();
  }, [debouncedSearch]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        // Fetch only upcoming open sessions
        const res = await sessionsApi.getSessions({ status: 'open', limit: 100 });
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setSessions(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedSessionId) {
        setSlots([]);
        return;
      }
      try {
        const res = await sessionsApi.getSessionSlots(selectedSessionId);
        if (res.success) {
          // Only show unbooked slots
          setSlots(res.data.filter((s: any) => !s.is_booked));
        }
      } catch (error) {
        console.error("Failed to fetch slots", error);
      }
    };
    fetchSlots();
  }, [selectedSessionId]);

  async function onSubmit(data: AppointmentFormValues) {
    setIsLoading(true);
    try {
      const payload = { ...data };
      if (!payload.slot_id) delete payload.slot_id;
      if (!payload.notes) delete payload.notes;

      const response = await appointmentsApi.createAppointment(payload);
      if (response.success) {
        toast.success("Appointment booked successfully");
        router.push(`/appointments/${response.data.appointment_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to book appointment");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/appointments"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Book Appointment</h1>
          <p className="text-slate-500">Schedule a patient for a channeling session.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Wizard</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-4 border p-4 rounded-lg bg-slate-50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Search patient by name or phone..." 
                    value={searchPatient}
                    onChange={(e) => setSearchPatient(e.target.value)}
                    className="pl-8 bg-white"
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Patient *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select patient from list" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {patients.map(p => (
                            <SelectItem key={p.patient_id} value={p.patient_id}>
                              {p.name} ({p.phone})
                            </SelectItem>
                          ))}
                          {patients.length === 0 && (
                            <SelectItem value="none" disabled>No patients found. Create one first.</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="session_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Session *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a doctor's session" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sessions.map(s => (
                          <SelectItem key={s.session_id} value={s.session_id}>
                            {new Date(s.session_date).toLocaleDateString()} | Dr. {s.doctor?.name} ({s.start_time}-{s.end_time})
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
                name="slot_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time Slot (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSessionId || slots.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedSessionId ? "Select a session first" : "Auto-assign next available"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {slots.map(s => (
                          <SelectItem key={s.slot_id} value={s.slot_id}>
                            {s.slot_time} (Queue #{s.slot_number})
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any specific symptoms or requests..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
