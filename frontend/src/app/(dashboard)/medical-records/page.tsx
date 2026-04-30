"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { medicalApi } from '@/lib/api/medical';
import { MedicalRecord } from '@/types/medical';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, FileText, User, Stethoscope, Calendar } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useDebounce } from '@/hooks/use-debounce';
import { hasPermission } from '@/lib/permissions';

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { user } = useAuthStore();

  if (!hasPermission(user?.role, 'medicalRecords')) {
    return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view medical records.</div>;
  }

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      try {
        const params: any = {};
        // Depending on API support for search
        if (debouncedSearch) params.patient_id = debouncedSearch; // Normally would be a real search param
        
        // If doctor, only see their own records. If patient_id was stored in user, could filter by patient.
        if (user?.role === 'Doctor') {
          // The API should handle this securely, but we can pass it if needed
        }
        
        const res = await medicalApi.getRecords(params);
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setRecords(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch medical records", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecords();
  }, [debouncedSearch, user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medical Records</h1>
          <p className="text-slate-500">View and manage clinical history and prescriptions.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Directory</CardTitle>
          <CardDescription>Searchable history of all patient consultations.</CardDescription>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              type="search"
              placeholder="Search by Patient ID or Name..."
              className="pl-8"
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
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Consulting Doctor</TableHead>
                  <TableHead className="hidden md:table-cell">Diagnosis</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                      Loading clinical records...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.record_id}>
                      <TableCell>
                        <div className="flex items-center text-sm font-medium">
                          <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                          {new Date(record.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <User className="mr-2 h-4 w-4 text-slate-400" />
                          {record.appointment?.patient?.name || 'Unknown Patient'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-slate-600">
                          <Stethoscope className="mr-2 h-4 w-4 text-blue-500" />
                          Dr. {record.appointment?.doctor?.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate text-slate-600 text-sm">
                        {record.diagnosis}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/medical-records/${record.record_id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            View
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
