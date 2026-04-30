"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { sessionsApi } from '@/lib/api/sessions';
import { Session } from '@/types/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Calendar, Clock, Building } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/permissions';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const { user } = useAuthStore();
  
  if (!hasPermission(user?.role, 'sessions')) {
    return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view sessions.</div>;
  }
  
  const canCreate = ['Super Admin', 'Hospital Admin', 'Receptionist'].includes(user?.role || '');

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const params: any = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        if (dateFilter) params.date = dateFilter;
        
        const res = await sessionsApi.getSessions(params);
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setSessions(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSessions();
  }, [statusFilter, dateFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 uppercase">Open</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase">Scheduled</Badge>;
      case 'closed': return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 uppercase">Closed</Badge>;
      default: return <Badge variant="outline" className="uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sessions</h1>
          <p className="text-slate-500">Manage doctor channeling sessions and schedules.</p>
        </div>
        
        {canCreate && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/sessions/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Schedule</CardTitle>
          <CardDescription>View all hospital sessions.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="w-full sm:w-1/3">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-1/3">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="text-center">Slots Booked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      Loading sessions...
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      No sessions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">
                        Dr. {session.doctor?.name}
                        <div className="text-xs text-slate-500 font-normal">{session.doctor?.specialization}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                          {new Date(session.session_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Clock className="mr-2 h-3 w-3" />
                          {session.start_time} - {session.end_time}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center text-sm text-slate-600">
                          <Building className="mr-2 h-4 w-4 text-slate-400" />
                          {session.branch?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                          {session.booked_count} / {session.max_patients}
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${(session.booked_count / session.max_patients) * 100}%` }}
                          ></div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sessions/${session.session_id}`}>
                            Manage
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
