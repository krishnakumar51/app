'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Laptop, Smartphone } from 'lucide-react';

import { useStore } from '@/lib/store';
import Header from '@/components/header';
import LaptopView from '@/components/laptop-view';
import PhoneView from '@/components/phone-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VisionWeaver() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role, setRole } = useStore();

  React.useEffect(() => {
    const roleFromUrl = searchParams.get('role');
    if (roleFromUrl === 'laptop' || roleFromUrl === 'phone') {
      setRole(roleFromUrl);
    }
  }, [searchParams, setRole]);
  
  const selectRole = (selectedRole: 'laptop' | 'phone') => {
    setRole(selectedRole);
    const params = new URLSearchParams(searchParams.toString());
    params.set('role', selectedRole);
    router.push(`?${params.toString()}`);
  }

  const renderContent = () => {
    switch (role) {
      case 'laptop':
        return <LaptopView />;
      case 'phone':
        return <PhoneView />;
      default:
        return (
          <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Choose Your Role</CardTitle>
                <CardDescription>
                  Select whether this device will send or receive video.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => selectRole('phone')}>
                  <Smartphone className="h-8 w-8" />
                  <span>Phone (Send)</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => selectRole('laptop')}>
                  <Laptop className="h-8 w-8" />
                  <span>Laptop (Receive)</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <Header role={role} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}
