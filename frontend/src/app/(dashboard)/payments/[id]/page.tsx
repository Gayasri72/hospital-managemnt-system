"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { paymentsApi } from '@/lib/api/payments';
import { Payment } from '@/types/payment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Printer, DollarSign, Calendar, CreditCard, Banknote, ShieldPlus, ReceiptText, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be positive"),
  payment_method: z.enum(['CASH', 'CARD', 'INSURANCE', 'ONLINE']),
  reference_number: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPaymentData = async () => {
    try {
      const res = await paymentsApi.getPaymentById(id);
      if (res.success) setPayment(res.data);
    } catch (error) {
      console.error("Failed to fetch payment details", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPaymentData();
  }, [id]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      amount: 0,
      payment_method: 'CASH',
      reference_number: '',
    },
  });

  // Pre-fill amount with balance when payment is loaded
  useEffect(() => {
    if (payment && payment.balance_amount > 0) {
      form.setValue('amount', payment.balance_amount);
    }
  }, [payment, form]);

  const onSubmit = async (data: PaymentFormValues) => {
    if (!payment) return;
    
    if (data.amount > payment.balance_amount) {
      toast.error("Payment amount cannot exceed the balance due");
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        appointment_id: payment.appointment_id,
        ...data,
      };
      
      const res = await paymentsApi.addTransaction(id, payload as any);
      if (res.success) {
        toast.success("Payment transaction processed successfully");
        fetchPaymentData();
        form.reset({ amount: 0, payment_method: 'CASH', reference_number: '' });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to process payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH': return <Banknote className="h-4 w-4 text-green-600" />;
      case 'CARD': return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'INSURANCE': return <ShieldPlus className="h-4 w-4 text-purple-600" />;
      case 'ONLINE': return <DollarSign className="h-4 w-4 text-indigo-600" />;
      default: return <DollarSign className="h-4 w-4 text-slate-600" />;
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading payment records...</div>;
  if (!payment) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/payments"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoice Details</h1>
              {payment.status === 'PAID' ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 uppercase text-sm px-2 py-1">Fully Paid</Badge>
              ) : payment.status === 'PARTIAL' ? (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase text-sm px-2 py-1">Partial</Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 uppercase text-sm px-2 py-1">Pending</Badge>
              )}
            </div>
            <p className="text-slate-500 font-mono text-sm mt-1">Invoice #{payment.payment_id}</p>
          </div>
        </div>
        <Button variant="outline" className="bg-white">
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Details & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <CardTitle className="text-lg flex items-center">
                <ReceiptText className="mr-2 h-5 w-5 text-slate-500" />
                Bill Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-y-6 mb-8">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Patient Name</p>
                  <p className="font-semibold">{payment.appointment?.patient?.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{payment.appointment?.patient?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Consulting Doctor</p>
                  <p className="font-semibold">Dr. {payment.appointment?.doctor?.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{payment.appointment?.doctor?.specialization}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Date Issued</p>
                  <div className="flex items-center text-slate-900 font-medium">
                    <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                    {new Date(payment.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Appointment</p>
                  <Button variant="link" className="p-0 h-auto font-medium" asChild>
                    <Link href={`/appointments/${payment.appointment_id}`}>
                      View Appointment #{payment.appointment?.queue_number}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (LKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Doctor Consultation Fee</TableCell>
                      <TableCell className="text-right">{payment.appointment?.doctor_fee.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Hospital Charge</TableCell>
                      <TableCell className="text-right">{payment.appointment?.hospital_charge.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 font-bold border-t-2">
                      <TableCell className="text-right">Total Payable Amount</TableCell>
                      <TableCell className="text-right text-lg">{payment.total_amount.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 flex justify-between items-center p-4 rounded-lg bg-green-50 border border-green-100">
                <span className="font-medium text-green-800">Total Paid So Far</span>
                <span className="font-bold text-xl text-green-700">{payment.amount_paid.toLocaleString()} LKR</span>
              </div>
            </CardContent>
          </Card>

          {payment.transactions && payment.transactions.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Transaction History</CardTitle>
                <CardDescription>Records of all payments made against this invoice.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payment.transactions.map((tx) => (
                    <div key={tx.transaction_id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-full">
                          {getPaymentMethodIcon(tx.payment_method)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{tx.payment_method} Payment</p>
                          <div className="flex items-center text-xs text-slate-500 mt-1">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                          {tx.reference_number && (
                            <p className="text-xs text-slate-500 mt-1 flex items-center">
                              <FileText className="mr-1 h-3 w-3" /> Ref: {tx.reference_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+{tx.amount.toLocaleString()} LKR</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">SUCCESS</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Payment Actions */}
        <div className="col-span-1 space-y-6">
          {payment.balance_amount > 0 ? (
            <Card className="shadow-md border-blue-200">
              <CardHeader className="bg-blue-50/50 border-b pb-4">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Balance Due</span>
                  <span className="text-2xl font-bold text-red-600">{payment.balance_amount.toLocaleString()} LKR</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Amount (LKR)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} className="text-lg font-bold" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CASH">Cash</SelectItem>
                              <SelectItem value="CARD">Credit/Debit Card</SelectItem>
                              <SelectItem value="INSURANCE">Insurance</SelectItem>
                              <SelectItem value="ONLINE">Online Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reference_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference No. (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Receipt or Transaction ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-2" disabled={isProcessing}>
                      {isProcessing ? "Processing..." : "Record Payment"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-green-200 bg-green-50">
              <CardContent className="pt-6 text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Fully Settled</h3>
                <p className="text-green-700 text-sm">This invoice has been completely paid.</p>
                <div className="mt-6 pt-6 border-t border-green-200">
                  <Button variant="outline" className="w-full bg-white text-green-800 border-green-300 hover:bg-green-100">
                    <Printer className="mr-2 w-4 h-4" /> Print Final Receipt
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning / Notes Card */}
          <Card className="bg-slate-50 border-0 shadow-none">
            <CardContent className="p-4 text-sm text-slate-500">
              <p className="font-semibold text-slate-700 mb-1 flex items-center">
                <ShieldPlus className="w-4 h-4 mr-2 text-slate-400" /> Need Help?
              </p>
              <p>Refunds can only be processed by Super Admin or authorized Account personnel. If you made an error, contact the administrator immediately.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
