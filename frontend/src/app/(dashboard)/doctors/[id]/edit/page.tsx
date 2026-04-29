"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

export default function EditDoctorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

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
    },
  });

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await doctorsApi.getDoctorById(id);
        if (response.success && response.data) {
          const doctor = response.data;
          form.reset({
            name: doctor.name || '',
            specialization: doctor.specialization || '',
            contact_number: doctor.contact_number || '',
            email: doctor.email || '',
            qualifications: doctor.profile?.qualifications || '',
            experience_years: doctor.profile?.experience_years || ('' as any),
            bio: doctor.profile?.bio || '',
          });
        }
      } catch (error) {
        toast.error("Failed to load doctor details");
        router.push('/doctors');
      } finally {
        setIsFetching(false);
      }
    };
    if (id) fetchDoctor();
  }, [id, form, router]);

  async function onSubmit(data: DoctorFormValues) {
    setIsLoading(true);
    try {
      const payload = { ...data };
      if (!payload.email) delete payload.email;
      if (!payload.contact_number) delete payload.contact_number;
      if (!payload.qualifications) delete payload.qualifications;
      if (!payload.bio) delete payload.bio;
      if (payload.experience_years === '') delete payload.experience_years;

      const response = await doctorsApi.updateDoctor(id, payload as any);
      if (response.success) {
        toast.success("Doctor updated successfully");
        router.push(`/doctors/${id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update doctor");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return <div className="p-8 text-center">Loading doctor...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/doctors/${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Doctor</h1>
          <p className="text-slate-500">Update medical professional details.</p>
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
                      <FormControl><Input type="number" placeholder="10" {...field} value={field.value as number} onChange={e => field.onChange(e.target.value)} /></FormControl>
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
