"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { patientsApi } from '@/lib/api/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const patientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  nic: z.string().min(10, "NIC must be at least 10 characters"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergency_contact: z.string().optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).optional().or(z.literal('')),
  age: z.coerce.number().min(0, "Age must be positive").optional().or(z.literal('')),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function EditPatientPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      name: '',
      nic: '',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
      age: '' as any,
      gender: '' as any,
    },
  });

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await patientsApi.getPatientById(id);
        if (response.success && response.data) {
          const patient = response.data;
          form.reset({
            name: patient.name || '',
            nic: patient.nic || '',
            phone: patient.phone || '',
            email: patient.email || '',
            address: patient.profile?.address || '',
            emergency_contact: patient.profile?.emergency_contact || '',
            gender: patient.profile?.gender as any || '',
            age: patient.profile?.age || ('' as any),
          });
        }
      } catch (error) {
        toast.error("Failed to load patient details");
        router.push('/patients');
      } finally {
        setIsFetching(false);
      }
    };
    if (id) fetchPatient();
  }, [id, form, router]);

  async function onSubmit(data: PatientFormValues) {
    setIsLoading(true);
    try {
      const payload = { ...data };
      if (!payload.email) delete payload.email;
      if (!payload.address) delete payload.address;
      if (!payload.emergency_contact) delete payload.emergency_contact;
      if (payload.age === '') delete payload.age;
      if (payload.gender === '') delete payload.gender;

      const response = await patientsApi.updatePatient(id, payload as any);
      if (response.success) {
        toast.success("Patient updated successfully");
        router.push(`/patients/${id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update patient");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return <div className="p-8 text-center">Loading patient...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/patients/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Patient</h1>
          <p className="text-slate-500">Update patient details in the system.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input placeholder="Kamal Perera" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIC / Passport *</FormLabel>
                      <FormControl><Input placeholder="901234567V" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl><Input placeholder="0771234567" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input type="email" placeholder="kamal@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl><Input type="number" placeholder="35" {...field} value={field.value as number} onChange={e => field.onChange(e.target.value)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergency_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl><Input placeholder="0779876543" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Address</FormLabel>
                    <FormControl><Input placeholder="123 Main St, Colombo 07" {...field} /></FormControl>
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
