"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { appointmentsApi } from '@/lib/api/appointments';
import { Appointment } from '@/types/appointment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Calendar, Clock, User, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { user } = useAuthStore();
  
  const canCreate = ['Super Admin', 'Hospital Admin', 'Receptionist'].includes(user?.role || '');

  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const params: any = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        // The API might not support global search directly, but we'll include it
        if (search) params.search = search;
        
        const res = await appointmentsApi.getAppointments(params);
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setAppointments(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch appointments", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchAppointments, 300);
    return () => clearTimeout(debounceTimer);
  }, [statusFilter, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked': return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 uppercase">Booked</Badge>;
      case 'confirmed': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase">Confirmed</Badge>;
      case 'arrived': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 uppercase">Arrived</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 uppercase"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 uppercase">Cancelled</Badge>;
      default: return <Badge variant="outline" className="uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointments</h1>
          <p className="text-slate-500">Manage patient bookings and channelings.</p>
        </div>
        
        {canCreate && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/appointments/new">
              <Plus className="mr-2 h-4 w-4" />
              Book Appointment
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Bookings</CardTitle>
          <CardDescription>View and filter patient appointments.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="w-full sm:w-1/3">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search patient..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-center">Queue</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="hidden md:table-cell">Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      Loading appointments...
                    </TableCell>
                  </TableRow>
                ) : appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      No appointments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments.map((appointment) => (
                    <TableRow key={appointment.appointment_id}>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-slate-700">
                          {appointment.queue_number}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          {appointment.patient?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        Dr. {appointment.doctor?.name}
                        <div className="text-xs text-slate-500">{appointment.doctor?.specialization}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                          {appointment.session?.session_date ? new Date(appointment.session.session_date).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Clock className="mr-2 h-3 w-3" />
                          {appointment.slot?.slot_time || 'Time TBD'}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/appointments/${appointment.appointment_id}`}>
                            View Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
