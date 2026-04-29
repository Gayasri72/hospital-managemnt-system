"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { patientsApi } from '@/lib/api/patients';
import { Patient } from '@/types/patient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Phone, Mail, MapPin, Hash, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const [patientRes, apptsRes] = await Promise.all([
          patientsApi.getPatientById(id),
          patientsApi.getPatientAppointments(id).catch(() => ({ success: true, data: [] }))
        ]);
        
        if (patientRes.success) setPatient(patientRes.data);
        if (apptsRes.success) setAppointments(apptsRes.data);
      } catch (error) {
        console.error("Failed to fetch patient details", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) fetchPatientData();
  }, [id]);

  if (isLoading) return <div className="p-8 text-center">Loading patient records...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Patient not found</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/patients"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{patient.name}</h1>
          <p className="text-slate-500">Patient ID: {patient.patient_id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Patient Info Sidebar */}
        <Card className="col-span-1 border-t-4 border-t-blue-600">
          <CardHeader className="text-center pb-2">
            <UserCircle className="h-24 w-24 mx-auto text-slate-300" />
            <CardTitle className="mt-4">{patient.name}</CardTitle>
            <CardDescription>{patient.profile?.gender || 'Unspecified'} • {patient.profile?.age ? `${patient.profile.age} years` : 'Age unknown'}</CardDescription>
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/patients/${id}/edit`}>Edit</Link>
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={isLoading}
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this patient?')) {
                    setIsLoading(true);
                    try {
                      await patientsApi.deletePatient(id);
                      router.push('/patients');
                    } catch (e) {
                      console.error(e);
                      setIsLoading(false);
                    }
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center text-sm">
              <Hash className="h-4 w-4 mr-3 text-slate-400" />
              <span>{patient.nic}</span>
            </div>
            <div className="flex items-center text-sm">
              <Phone className="h-4 w-4 mr-3 text-slate-400" />
              <span>{patient.phone}</span>
            </div>
            {patient.email && (
              <div className="flex items-center text-sm">
                <Mail className="h-4 w-4 mr-3 text-slate-400" />
                <span>{patient.email}</span>
              </div>
            )}
            {patient.profile?.address && (
              <div className="flex items-start text-sm">
                <MapPin className="h-4 w-4 mr-3 text-slate-400 mt-0.5" />
                <span>{patient.profile.address}</span>
              </div>
            )}
            {patient.profile?.emergency_contact && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-slate-500 mb-1">Emergency Contact</p>
                <div className="flex items-center text-sm font-medium">
                  <Phone className="h-4 w-4 mr-3 text-red-400" />
                  {patient.profile.emergency_contact}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Content Area */}
        <Card className="col-span-1 md:col-span-2 shadow-sm border-0 bg-transparent">
          <Tabs defaultValue="appointments" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white border">
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="records">Medical Records</TabsTrigger>
              <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="appointments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Appointment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-slate-500 text-sm">No past appointments found.</p>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appt) => (
                        <div key={appt.appointment_id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Dr. {appt.doctor?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">
                              {appt.session?.session_date ? new Date(appt.session.session_date).toLocaleDateString() : 'Unknown Date'} • Queue: {appt.queue_number}
                            </p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${appt.status === 'completed' ? 'bg-green-100 text-green-700' : 
                              appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                              'bg-blue-100 text-blue-700'}`}
                          >
                            {appt.status.toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="records" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Medical Records</CardTitle>
                  <CardDescription>Clinical notes and diagnoses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500 text-sm">Go to Medical Records module to view full clinical details.</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="prescriptions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Prescriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500 text-sm">No recent prescriptions.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
