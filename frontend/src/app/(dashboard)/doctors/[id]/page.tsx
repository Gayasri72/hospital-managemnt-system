"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doctorsApi } from '@/lib/api/doctors';
import { Doctor } from '@/types/doctor';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Phone, Mail, Award, Clock, ArrowLeft, Building, Activity, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function DoctorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        const [docRes, feesRes, sessionsRes] = await Promise.all([
          doctorsApi.getDoctorById(id),
          doctorsApi.getDoctorFees(id).catch(() => ({ success: true, data: [] })),
          doctorsApi.getDoctorSessions(id).catch(() => ({ success: true, data: [] }))
        ]);
        
        if (docRes.success) setDoctor(docRes.data);
        if (feesRes.success) setFees(feesRes.data);
        if (sessionsRes.success) setSessions(sessionsRes.data);
      } catch (error) {
        console.error("Failed to fetch doctor details", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) fetchDoctorData();
  }, [id]);

  if (isLoading) return <div className="p-8 text-center">Loading doctor records...</div>;
  if (!doctor) return <div className="p-8 text-center text-red-500">Doctor not found</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/doctors"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dr. {doctor.name}</h1>
              {doctor.status === 'active' ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 cursor-pointer" onClick={async () => {
                  if (confirm('Deactivate this doctor?')) {
                    await doctorsApi.updateStatus(id, 'inactive');
                    window.location.reload();
                  }
                }}>Active</Badge>
              ) : doctor.status === 'on_leave' ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 cursor-pointer" onClick={async () => {
                  if (confirm('Set status to Active?')) {
                    await doctorsApi.updateStatus(id, 'active');
                    window.location.reload();
                  }
                }}>On Leave</Badge>
              ) : (
                <Badge variant="secondary" className="cursor-pointer" onClick={async () => {
                  if (confirm('Reactivate this doctor?')) {
                    await doctorsApi.updateStatus(id, 'active');
                    window.location.reload();
                  }
                }}>Inactive</Badge>
              )}
            </div>
            <p className="text-slate-500">{doctor.specialization}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/doctors/${id}/edit`}>Edit Details</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isLoading}
            onClick={async () => {
              if (confirm('Deactivate this doctor? They will no longer appear in session booking.')) {
                setIsLoading(true);
                try {
                  await doctorsApi.updateStatus(id, 'inactive');
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  setIsLoading(false);
                }
              }
            }}
          >
            Deactivate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Doctor Info Sidebar */}
        <Card className="col-span-1 border-t-4 border-t-blue-600">
          <CardHeader className="text-center pb-2">
            <div className="h-24 w-24 mx-auto rounded-full bg-blue-50 flex items-center justify-center border-4 border-white shadow-sm">
              <Stethoscope className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="mt-4">Dr. {doctor.name}</CardTitle>
            <CardDescription>{doctor.specialization}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {doctor.profile?.qualifications && (
              <div className="flex items-start text-sm">
                <Award className="h-4 w-4 mr-3 text-blue-500 mt-0.5" />
                <span>{doctor.profile.qualifications}</span>
              </div>
            )}
            {doctor.profile?.experience_years && (
              <div className="flex items-center text-sm">
                <Activity className="h-4 w-4 mr-3 text-slate-400" />
                <span>{doctor.profile.experience_years} Years Experience</span>
              </div>
            )}
            <div className="flex items-center text-sm">
              <Phone className="h-4 w-4 mr-3 text-slate-400" />
              <span>{doctor.contact_number || 'No contact'}</span>
            </div>
            {doctor.email && (
              <div className="flex items-center text-sm">
                <Mail className="h-4 w-4 mr-3 text-slate-400" />
                <span>{doctor.email}</span>
              </div>
            )}
            {doctor.current_fee && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-slate-500 mb-1">Current Consultation Fee</p>
                <div className="flex items-center text-lg font-bold text-slate-900">
                  <DollarSign className="h-5 w-5 text-green-600 mr-1" />
                  {doctor.current_fee.consultation_fee.toLocaleString()} LKR
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Content Area */}
        <Card className="col-span-1 md:col-span-2 shadow-sm border-0 bg-transparent">
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white border">
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="fees">Fee History</TabsTrigger>
              <TabsTrigger value="profile">Full Profile</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sessions" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Channeling Sessions</CardTitle>
                    <CardDescription>Upcoming and recent sessions.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sessions/new?doctor_id=${doctor.doctor_id}`}>New Session</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p>No sessions scheduled.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessions.map((session) => (
                        <div key={session.session_id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="bg-blue-50 text-blue-700 rounded-md p-3 text-center min-w-[70px]">
                              <p className="text-xs font-bold uppercase">{new Date(session.session_date).toLocaleString('default', { month: 'short' })}</p>
                              <p className="text-xl font-bold">{new Date(session.session_date).getDate()}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-900">{session.start_time} - {session.end_time}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                  ${session.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 
                                    session.status === 'open' ? 'bg-green-100 text-green-700' : 
                                    'bg-slate-100 text-slate-700'}`}
                                >
                                  {session.status}
                                </span>
                              </div>
                              <div className="flex items-center text-sm text-slate-500 gap-4">
                                <span className="flex items-center"><Building className="h-3 w-3 mr-1" /> {session.branch?.name}</span>
                                <span className="flex items-center"><Users className="h-3 w-3 mr-1" /> {session.booked_count}/{session.max_patients} Booked</span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/sessions/${session.session_id}`}>View</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="fees" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Fee Configuration History</CardTitle>
                  <Button variant="outline" size="sm" onClick={async () => {
                    const newFee = prompt('Enter new consultation fee (LKR):');
                    if (newFee && !isNaN(Number(newFee))) {
                      try {
                        await doctorsApi.addFee(id, { consultation_fee: Number(newFee), effective_from: new Date().toISOString().split('T')[0] });
                        window.location.reload();
                      } catch (e) {
                        console.error(e);
                        alert('Failed to update fee');
                      }
                    }
                  }}>Update Fee</Button>
                </CardHeader>
                <CardContent>
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                    {fees.map((fee, idx) => (
                      <div key={fee.fee_id} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white ${fee.is_active ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                        <div className="mb-1 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900">{fee.consultation_fee.toLocaleString()} LKR</h4>
                          {fee.is_active && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 h-5">Current</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">
                          Effective: {new Date(fee.effective_from).toLocaleDateString()}
                          {fee.effective_to ? ` to ${new Date(fee.effective_to).toLocaleDateString()}` : ' onwards'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Professional Bio</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {doctor.profile?.bio || 'No biography available for this doctor.'}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

// Dummy import to prevent un-used var error in the copy-pasted layout
import { Users } from 'lucide-react';
