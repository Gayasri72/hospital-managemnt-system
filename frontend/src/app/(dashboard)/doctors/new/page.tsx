"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doctorsApi } from '@/lib/api/doctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const doctorSchema = z.object({
  name: z.string().min(2, "Name is required"),
  specialization: z.string().min(2, "Specialization is required"),
  contact_number: z.string().optional().or(z.literal('')),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  qualifications: z.string().optional().or(z.literal('')),
  experience_years: z.coerce.number().min(0, "Experience cannot be negative").optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
  consultation_fee: z.coerce.number().min(0, "Fee must be a valid amount"),
  effective_from: z.string().min(1, "Effective date is required"),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

export default function NewDoctorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema) as any,
    defaultValues: {
      name: '',
      specialization: '',
      contact_number: '',
      email: '',
      qualifications: '',
      experience_years: '' as any,
      bio: '',
      consultation_fee: 0,
      effective_from: new Date().toISOString().split('T')[0],
    },
  });

  async function onSubmit(data: DoctorFormValues) {
    setIsLoading(true);
    try {
      const payload = { ...data };
      if (!payload.email) delete payload.email;
      if (!payload.contact_number) delete payload.contact_number;
      if (!payload.qualifications) delete payload.qualifications;
      if (!payload.bio) delete payload.bio;
      if (payload.experience_years === '') delete payload.experience_years;

      const response = await doctorsApi.createDoctor(payload as any);
      if (response.success) {
        toast.success("Doctor registered successfully");
        router.push(`/doctors/${response.data.doctor_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to register doctor");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/doctors"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Doctor</h1>
          <p className="text-slate-500">Register a new medical professional.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Professional Details</CardTitle>
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
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialization *</FormLabel>
                      <FormControl><Input placeholder="Cardiologist" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
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
                      <FormControl><Input type="email" placeholder="doctor@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of Experience</FormLabel>
                      <FormControl><Input type="number" placeholder="10" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualifications</FormLabel>
                      <FormControl><Input placeholder="MBBS, MD" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Professional Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief summary of expertise..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">Initial Fee Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="consultation_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation Fee (LKR) *</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="2500" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="effective_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective From Date *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Register Doctor"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
