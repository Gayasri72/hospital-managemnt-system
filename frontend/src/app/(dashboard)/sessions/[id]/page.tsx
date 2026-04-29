"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionsApi } from '@/lib/api/sessions';
import { Session, SessionSlot } from '@/types/session';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Square, Calendar, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [session, setSession] = useState<Session | null>(null);
  const [slots, setSlots] = useState<SessionSlot[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchSessionData = async () => {
    try {
      const [sessionRes, slotsRes, queueRes] = await Promise.all([
        sessionsApi.getSessionById(id),
        sessionsApi.getSessionSlots(id).catch(() => ({ success: true, data: [] })),
        sessionsApi.getSessionQueue(id).catch(() => ({ success: true, data: [] }))
      ]);
      
      if (sessionRes.success) setSession(sessionRes.data);
      if (slotsRes.success) setSlots(slotsRes.data);
      if (queueRes.success) {
        // The backend returns { waiting: [], in_clinic: [], done: [] }
        // We flatten it back into a single array for the UI and sort by queue number
        const qData = queueRes.data || {};
        const flatQueue = [
          ...(qData.waiting || []),
          ...(qData.in_clinic || []),
          ...(qData.done || [])
        ].sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0));
        setQueue(flatQueue);
      }
    } catch (error) {
      console.error("Failed to fetch session details", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchSessionData();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await sessionsApi.updateSessionStatus(id, newStatus);
      if (res.success) {
        toast.success(`Session status changed to ${newStatus}`);
        fetchSessionData(); // Refresh data
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update session status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading session records...</div>;
  if (!session) return <div className="p-8 text-center text-red-500">Session not found</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sessions"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Session Details</h1>
              <Badge variant="outline" className="uppercase">{session.status}</Badge>
            </div>
            <p className="text-slate-500">Dr. {session.doctor?.name} • {new Date(session.session_date).toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {session.status === 'scheduled' && (
            <Button onClick={() => handleStatusChange('open')} disabled={isUpdatingStatus} className="bg-green-600 hover:bg-green-700">
              <Play className="mr-2 h-4 w-4" /> Start Session
            </Button>
          )}
          {session.status === 'open' && (
            <Button onClick={() => handleStatusChange('closed')} disabled={isUpdatingStatus} variant="destructive">
              <Square className="mr-2 h-4 w-4" /> Close Session
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/sessions/${id}/edit`}>Edit</Link>
          </Button>
          <Button 
            variant="destructive" 
            onClick={async () => {
              if (confirm('Are you sure you want to delete this session?')) {
                try {
                  await sessionsApi.deleteSession(id);
                  router.push('/sessions');
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Session Info Sidebar */}
        <Card className="col-span-1 shadow-sm border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Date</p>
                <p className="font-semibold">{new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Time & Duration</p>
                <p className="font-semibold">{session.start_time} - {session.end_time}</p>
                <p className="text-xs text-slate-500 mt-0.5">{session.slot_duration} min per patient</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Location</p>
                <p className="font-semibold">{session.branch?.name}</p>
              </div>
            </div>

            <div className="pt-6 border-t">
              <h4 className="text-sm font-medium text-slate-900 mb-2">Booking Status</h4>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Booked</span>
                <span className="font-medium">{session.booked_count} of {session.max_patients} slots</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ width: `${(session.booked_count / session.max_patients) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content Area */}
        <Card className="col-span-1 md:col-span-2 shadow-sm border-0 bg-transparent">
          <Tabs defaultValue="slots" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white border">
              <TabsTrigger value="slots">Time Slots Grid</TabsTrigger>
              <TabsTrigger value="queue">Live Queue</TabsTrigger>
            </TabsList>
            
            <TabsContent value="slots" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Available & Booked Slots</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6 text-sm text-slate-600">
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-slate-100 border mr-2"></div> Available</div>
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-100 border border-red-200 mr-2"></div> Booked</div>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {slots.map((slot) => (
                      <div 
                        key={slot.slot_id} 
                        className={`p-3 rounded-lg border text-center relative ${
                          slot.is_booked 
                            ? 'bg-red-50 border-red-200 text-red-900 cursor-not-allowed opacity-80' 
                            : 'bg-white hover:border-blue-500 cursor-pointer hover:shadow-sm transition-all'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-400 mb-1">#{slot.slot_number}</div>
                        <div className="font-semibold text-sm">{slot.slot_time}</div>
                        {slot.is_booked && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>}
                      </div>
                    ))}
                    {slots.length === 0 && (
                      <div className="col-span-full text-center py-8 text-slate-500">
                        No slots generated for this session.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="queue" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Appointment Queue</CardTitle>
                  <CardDescription>Patients scheduled for this session in order.</CardDescription>
                </CardHeader>
                <CardContent>
                  {queue.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                      <p>No patients booked yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {queue.map((item, index) => (
                        <div key={item.appointment_id} className="flex items-center p-4 border rounded-lg bg-white shadow-sm hover:shadow transition-shadow">
                          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg mr-4">
                            {item.queue_number}
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-semibold text-slate-900">{item.patient?.name}</h4>
                            <p className="text-sm text-slate-500">Slot: {item.slot?.slot_time || 'N/A'}</p>
                          </div>
                          <div>
                            {item.status === 'completed' ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1"/> Done</Badge>
                            ) : item.status === 'arrived' ? (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Arrived</Badge>
                            ) : (
                              <Badge variant="outline" className="uppercase">{item.status}</Badge>
                            )}
                          </div>
                          <div className="ml-4">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/appointments/${item.appointment_id}`}>Details</Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
