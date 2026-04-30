"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { patientsApi } from '@/lib/api/patients';
import { Patient } from '@/types/patient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Plus, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user } = useAuthStore();
  
  if (!hasPermission(user?.role, 'patients')) {
    return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view patients.</div>;
  }
  
  const canCreate = ['Super Admin', 'Hospital Admin', 'Receptionist'].includes(user?.role || '');

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const res = await patientsApi.getPatients({ search });
        if (res.success) {
          // Check if data is an array directly, or inside items (pagination)
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setPatients(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch patients", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(debounceTimer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patients</h1>
          <p className="text-slate-500">Manage hospital patient records and history.</p>
        </div>
        
        {canCreate && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/patients/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Patient
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Directory</CardTitle>
          <CardDescription>A list of all registered patients.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              type="search"
              placeholder="Search by name, NIC or phone..."
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
                  <TableHead>NIC</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Gender</TableHead>
                  <TableHead className="hidden lg:table-cell">Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      Loading patients...
                    </TableCell>
                  </TableRow>
                ) : patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                      No patients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient) => (
                    <TableRow key={patient.patient_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-5 w-5 text-slate-400" />
                          {patient.name}
                        </div>
                      </TableCell>
                      <TableCell>{patient.nic}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell className="hidden md:table-cell">{patient.profile?.gender || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{patient.profile?.age || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/patients/${patient.patient_id}`)}>
                          View Details
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
