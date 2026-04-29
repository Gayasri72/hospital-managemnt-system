"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { appointmentsApi } from '@/lib/api/appointments';
import { Appointment } from '@/types/appointment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Stethoscope, Calendar, Clock, MapPin, CheckCircle2, FileText, Printer, FileDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AppointmentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchAppointmentData = async () => {
    try {
      const [apptRes, receiptRes] = await Promise.all([
        appointmentsApi.getAppointmentById(id),
        appointmentsApi.getReceiptData(id).catch(() => ({ success: true, data: null }))
      ]);
      
      if (apptRes.success) setAppointment(apptRes.data);
      if (receiptRes.success && receiptRes.data) setReceiptData(receiptRes.data);
    } catch (error) {
      console.error("Failed to fetch appointment details", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchAppointmentData();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await appointmentsApi.updateAppointmentStatus(id, newStatus);
      if (res.success) {
        toast.success(`Appointment marked as ${newStatus}`);
        fetchAppointmentData(); // Refresh data
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update appointment status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading appointment records...</div>;
  if (!appointment) return <div className="p-8 text-center text-red-500">Appointment not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/appointments"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointment #{appointment.queue_number}</h1>
              {appointment.status === 'completed' ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 uppercase"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>
              ) : appointment.status === 'cancelled' ? (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 uppercase">Cancelled</Badge>
              ) : appointment.status === 'arrived' ? (
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 uppercase">Arrived</Badge>
              ) : appointment.status === 'confirmed' ? (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase">Confirmed</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 uppercase">Booked</Badge>
              )}
            </div>
            <p className="text-slate-500">Created on {new Date(appointment.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Status Action Bar */}
      <Card className="bg-white border-blue-100 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
          <div className="flex items-center text-sm font-medium text-slate-600 w-full sm:w-auto">
            <span className="mr-4">Update Status:</span>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" size="sm" 
                className={appointment.status === 'confirmed' ? 'bg-blue-50 border-blue-200' : ''}
                onClick={() => handleStatusChange('confirmed')}
                disabled={isUpdatingStatus || ['completed', 'cancelled'].includes(appointment.status)}
              >
                Confirm
              </Button>
              <Button 
                variant="outline" size="sm"
                className={appointment.status === 'arrived' ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}
                onClick={() => handleStatusChange('arrived')}
                disabled={isUpdatingStatus || ['completed', 'cancelled'].includes(appointment.status)}
              >
                Mark Arrived
              </Button>
              <Button 
                variant="outline" size="sm"
                className={appointment.status === 'completed' ? 'bg-green-50 border-green-200 text-green-700' : 'hover:bg-green-50 hover:text-green-700 hover:border-green-200'}
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdatingStatus || appointment.status === 'cancelled' || appointment.status === 'completed'}
              >
                Complete Visit
              </Button>
              <Button 
                variant="outline" size="sm"
                className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                onClick={() => handleStatusChange('cancelled')}
                disabled={isUpdatingStatus || ['completed', 'cancelled'].includes(appointment.status)}
              >
                Cancel
              </Button>
              <Button 
                variant="outline" size="sm"
                onClick={async () => {
                  const newSession = prompt('Enter new Session ID:');
                  if (newSession) {
                    try {
                      await appointmentsApi.rescheduleAppointment(id, { session_id: newSession });
                      window.location.reload();
                    } catch (e) {
                      alert('Failed to reschedule');
                    }
                  }
                }}
                disabled={isUpdatingStatus || ['completed', 'cancelled'].includes(appointment.status)}
              >
                Reschedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Booking Details */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><Calendar className="w-5 h-5 mr-2 text-blue-500"/> Schedule Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-5 h-5"/></div>
                <div>
                  <p className="text-sm text-slate-500">Date & Time</p>
                  <p className="font-semibold text-slate-900">
                    {appointment.session?.session_date ? new Date(appointment.session.session_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A'}
                  </p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">Time: {appointment.slot?.slot_time || 'TBD'}</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Queue #</p>
                <p className="text-3xl font-bold text-blue-600">{appointment.queue_number}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-b pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Stethoscope className="w-5 h-5"/></div>
              <div>
                <p className="text-sm text-slate-500">Consulting Doctor</p>
                <p className="font-semibold text-slate-900">Dr. {appointment.doctor?.name}</p>
                <p className="text-sm text-slate-600">{appointment.doctor?.specialization}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MapPin className="w-5 h-5"/></div>
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="font-semibold text-slate-900">{appointment.session?.branch?.name || 'Hospital Main Branch'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Details */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center"><User className="w-5 h-5 mr-2 text-blue-500"/> Patient Information</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/patients/${appointment.patient_id}`}>View Profile</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-900">{appointment.patient?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">NIC / ID</p>
                <p className="font-medium text-slate-900">{appointment.patient?.nic}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{appointment.patient?.phone}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-slate-500 mb-1">Booking Notes</p>
                <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-100">
                  {appointment.notes}
                </div>
              </div>
            )}
            
            {appointment.status === 'completed' && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-900">Medical Record</p>
                  <p className="text-xs text-slate-500">Clinical notes for this visit</p>
                </div>
                {appointment.medical_record ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/medical-records/${appointment.medical_record.record_id}`}><FileText className="w-4 h-4 mr-2"/> View Record</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="text-blue-600" asChild>
                    <Link href={`/medical-records/new?appointment_id=${appointment.appointment_id}`}><Plus className="w-4 h-4 mr-2"/> Add Record</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="md:col-span-2 shadow-sm border-t-4 border-t-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Billing & Payment</CardTitle>
              <CardDescription>Fee breakdown for this appointment.</CardDescription>
            </div>
            {receiptData && (
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2"/> Print Receipt
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {receiptData ? (
              <div className="bg-slate-50 p-4 rounded-lg border mt-2">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-sm text-slate-500">Receipt No.</p>
                    <p className="font-mono font-medium">{receiptData.receipt_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Payment Status</p>
                    <Badge className="bg-green-100 text-green-800 uppercase mt-1">Paid</Badge>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Doctor's Consultation Fee</span>
                    <span className="font-medium">{receiptData.breakdown.doctor_fee.toLocaleString()} LKR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Hospital Charge</span>
                    <span className="font-medium">{receiptData.breakdown.hospital_charge.toLocaleString()} LKR</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t font-bold text-lg">
                    <span>Total Amount</span>
                    <span>{receiptData.breakdown.total.toLocaleString()} LKR</span>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button asChild>
                    <Link href={`/payments/${receiptData.payment_id}`}>View Full Payment</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed mt-2">
                <p className="text-slate-500 mb-4">No payment has been recorded for this appointment yet.</p>
                <Button asChild className="bg-slate-800 hover:bg-slate-900">
                  <Link href={`/payments/new?appointment_id=${appointment.appointment_id}`}>
                    <DollarSign className="w-4 h-4 mr-2"/> Process Payment
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Just to avoid un-used variables if I used DollarSign and it wasn't imported
import { DollarSign } from 'lucide-react';
