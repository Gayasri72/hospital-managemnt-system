"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { paymentsApi } from '@/lib/api/payments';
import { appointmentsApi } from '@/lib/api/appointments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { toast } from 'sonner';
import { ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';

const paymentSchema = z.object({
  appointment_id: z.string().min(1, "Appointment ID is required"),
  patient_id: z.string().min(1, "Patient ID is required"),
  doctor_fee: z.coerce.number().min(0, "Doctor fee must be non-negative"),
  hospital_charge: z.coerce.number().min(0, "Hospital charge must be non-negative"),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointment_id');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAppt, setIsFetchingAppt] = useState(!!appointmentId);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      appointment_id: appointmentId || '',
      patient_id: '',
      doctor_fee: 0,
      hospital_charge: 1000, // Default hospital charge
    },
  });

  const doctorFee = form.watch('doctor_fee');
  const hospitalCharge = form.watch('hospital_charge');
  const totalAmount = (Number(doctorFee) || 0) + (Number(hospitalCharge) || 0);

  useEffect(() => {
    const fetchAppt = async () => {
      try {
        const response = await appointmentsApi.getAppointmentById(appointmentId!);
        if (response.success && response.data) {
          const appt = response.data;
          setAppointmentDetails(appt);
          form.setValue('patient_id', appt.patient_id);
          
          if (appt.doctor?.current_fee) {
            form.setValue('doctor_fee', appt.doctor.current_fee.consultation_fee);
          }
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

  async function onSubmit(data: PaymentFormValues) {
    setIsLoading(true);
    try {
      const response = await paymentsApi.createPayment(data as any);
      if (response.success) {
        toast.success("Payment record created successfully");
        router.push(`/payments/${response.data.payment_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create payment record");
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetchingAppt) {
    return <div className="p-8 text-center">Loading billing data...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/payments"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Generate Bill</h1>
          <p className="text-slate-500">Create a new payment record for an appointment.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
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
                  
                  {appointmentDetails && (
                    <div className="bg-blue-50 p-3 rounded-md text-sm">
                      <p className="font-semibold text-blue-900">Patient: {appointmentDetails.patient?.name}</p>
                      <p className="text-blue-700">Dr. {appointmentDetails.doctor?.name}</p>
                      <p className="text-xs text-blue-500 mt-1">Date: {new Date(appointmentDetails.session?.session_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-4">Fee Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="doctor_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor Consultation Fee (LKR) *</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hospital_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hospital Facility Charge (LKR) *</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    {isLoading ? "Generating..." : "Generate Bill"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Live Summary Card */}
        <Card className="col-span-1 shadow-sm border-t-4 border-t-green-500 self-start">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><Calculator className="w-5 h-5 mr-2 text-green-600"/> Bill Summary</CardTitle>
            <CardDescription>Live preview of the total amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Doctor Fee</span>
              <span className="font-medium">{Number(doctorFee || 0).toLocaleString()} LKR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Hospital Charge</span>
              <span className="font-medium">{Number(hospitalCharge || 0).toLocaleString()} LKR</span>
            </div>
            
            <div className="pt-4 border-t mt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">Total Due</span>
                <span className="text-xl font-bold text-green-600">{totalAmount.toLocaleString()} LKR</span>
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-md text-xs text-slate-500 mt-4 text-center">
              A bill must be generated before payments can be processed.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
