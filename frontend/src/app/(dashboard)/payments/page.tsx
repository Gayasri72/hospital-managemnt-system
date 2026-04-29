"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { paymentsApi } from '@/lib/api/payments';
import { Payment } from '@/types/payment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, Calendar, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    const fetchPayments = async () => {
      setIsLoading(true);
      try {
        const params: any = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        // Search usually searches appointment/patient but depends on backend implementation
        
        const res = await paymentsApi.getPayments(params);
        if (res.success) {
          const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setPayments(dataArray);
        }
      } catch (error) {
        console.error("Failed to fetch payments", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayments();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 uppercase">Pending</Badge>;
      case 'PARTIAL': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase">Partial</Badge>;
      case 'PAID': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 uppercase">Paid</Badge>;
      default: return <Badge variant="outline" className="uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments & Billing</h1>
          <p className="text-slate-500">Manage patient invoices, payments, and receipts.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>View all billing records for appointments.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="w-full sm:w-1/3">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search..."
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
                  <TableHead>Invoice / Date</TableHead>
                  <TableHead>Patient / Appointment</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Paid Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-slate-500">
                      Loading billing data...
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-slate-500">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.payment_id}>
                      <TableCell>
                        <div className="font-mono text-xs text-slate-500 truncate w-24" title={payment.payment_id}>
                          ...{payment.payment_id.substring(payment.payment_id.length - 8)}
                        </div>
                        <div className="flex items-center text-xs mt-1 text-slate-900">
                          <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                          {new Date(payment.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.appointment?.patient?.name || 'Unknown Patient'}
                        <div className="text-xs text-slate-500 font-normal">
                          Dr. {payment.appointment?.doctor?.name} | {new Date(payment.appointment?.session?.session_date || payment.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {payment.total_amount.toLocaleString()} LKR
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {payment.amount_paid.toLocaleString()} LKR
                      </TableCell>
                      <TableCell className="text-right text-red-500 font-medium">
                        {payment.balance_amount > 0 ? `${payment.balance_amount.toLocaleString()} LKR` : '-'}
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/payments/${payment.payment_id}`}>
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
