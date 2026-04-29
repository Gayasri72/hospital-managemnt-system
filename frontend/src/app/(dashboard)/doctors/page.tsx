"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doctorsApi } from '@/lib/api/doctors';
import { Doctor } from '@/types/doctor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Stethoscope } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user } = useAuthStore();
  
  const canCreate = ['Super Admin', 'Hospital Admin'].includes(user?.role || '');

  useEffect(() => {
    const fetchDoctors = async () => {
      setIsLoading(true);
      try {
        const res = await doctorsApi.getDoctors({ search });
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setDoctors(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch doctors", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchDoctors, 300);
    return () => clearTimeout(debounceTimer);
  }, [search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'inactive': return <Badge variant="secondary">Inactive</Badge>;
      case 'on_leave': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">On Leave</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctors</h1>
          <p className="text-slate-500">Manage hospital medical staff and consultants.</p>
        </div>
        
        {canCreate && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/doctors/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Doctor
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doctor Directory</CardTitle>
          <CardDescription>A list of all registered doctors.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              type="search"
              placeholder="Search by name or specialization..."
              className="pl-8 max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Fee (LKR)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      Loading doctors...
                    </TableCell>
                  </TableRow>
                ) : doctors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      No doctors found.
                    </TableCell>
                  </TableRow>
                ) : (
                  doctors.map((doctor) => (
                    <TableRow key={doctor.doctor_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                            <Stethoscope className="h-4 w-4" />
                          </div>
                          Dr. {doctor.name}
                        </div>
                      </TableCell>
                      <TableCell>{doctor.specialization}</TableCell>
                      <TableCell>
                        <div className="text-sm">{doctor.contact_number || '-'}</div>
                        <div className="text-xs text-slate-500">{doctor.email}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {doctor.current_fee ? doctor.current_fee.consultation_fee.toLocaleString() : 'Not Set'}
                      </TableCell>
                      <TableCell>{getStatusBadge(doctor.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/doctors/${doctor.doctor_id}`}>
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
