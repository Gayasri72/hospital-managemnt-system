"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { adminApi } from '@/lib/api/admin';
import { Role } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must contain uppercase, lowercase, and number"),
  role_id: z.coerce.number().min(1, "Role is required"),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function AddUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role_id: undefined as any,
    },
  });

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await adminApi.getRoles();
        if (res.success) setRoles(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        toast.error("Failed to load roles");
      }
    };
    if (isSuperAdmin) fetchRoles();
  }, [isSuperAdmin]);

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      const res = await adminApi.createUser(data);
      if (res.success) {
        toast.success("User created successfully");
        router.push('/admin/users');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSuperAdmin) return <div className="p-8 text-center text-red-500 font-medium">Access Restricted</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New User</h1>
          <p className="text-slate-500">Create a new hospital staff account.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Setup the user's basic profile and credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl><Input type="email" placeholder="john@hospital.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password *</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormDescription>The user can change this after their first login.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Role *</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString() || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map(r => (
                          <SelectItem key={r.role_id} value={r.role_id.toString()}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>This determines what features the user can access.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create User Account"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
