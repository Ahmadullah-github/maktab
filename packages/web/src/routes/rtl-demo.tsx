import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DirectionalText, NumberText } from '@/components/ui/DirectionalText';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Calendar, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/rtl-demo')({
  component: RTLDemoPage,
});

function RTLDemoPage() {
  const { t } = useTranslation();
  const { isRTL, direction } = useDirection();

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-natural">RTL Layout Demo</h1>
          <p className="text-muted-foreground text-natural mt-2">
            Testing RTL support for Persian/Dari content
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Direction Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-natural">Current Direction</CardTitle>
          <CardDescription className="text-natural">
            Language: {isRTL ? 'Persian/Dari (فارسی)' : 'English'} | Direction:{' '}
            {direction.toUpperCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${isRTL ? 'bg-green-100' : 'bg-gray-100'}`}
            >
              {isRTL ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
              <span className="text-natural">
                Text flows {isRTL ? 'right to left' : 'left to right'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mixed Content Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-natural">Persian Text with Numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-natural">
              <p>مدرسه ابتدایی شهید احمد</p>
              <p>
                تعداد دانش‌آموزان: <NumberText>245</NumberText> نفر
              </p>
              <p>
                سال تحصیلی: <NumberText>1403-1404</NumberText>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-natural">English Text with Numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="ltr-content">
              <p>Ahmad Elementary School</p>
              <p>Students: 245 people</p>
              <p>Academic Year: 2024-2025</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Layout Components */}
      <Card>
        <CardHeader>
          <CardTitle className="text-natural">Layout Components</CardTitle>
          <CardDescription className="text-natural">
            Testing how UI components adapt to RTL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Users className="h-5 w-5 text-primary icon-no-flip" />
              <div>
                <div className="font-medium text-natural">Teachers</div>
                <div className="text-sm text-muted-foreground">
                  <NumberText>24</NumberText> active
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Calendar className="h-5 w-5 text-primary icon-no-flip" />
              <div>
                <div className="font-medium text-natural">Classes</div>
                <div className="text-sm text-muted-foreground">
                  <NumberText>12</NumberText> total
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Clock className="h-5 w-5 text-primary icon-no-flip" />
              <div>
                <div className="font-medium text-natural">Periods</div>
                <div className="text-sm text-muted-foreground">
                  <NumberText>8</NumberText> per day
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-natural">Interactive Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button>
              <ArrowLeft
                className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} ${isRTL ? 'icon-flip' : ''}`}
              />
              <span className="text-natural">Previous</span>
            </Button>

            <Button variant="outline">
              <span className="text-natural">Save Changes</span>
              <ArrowRight
                className={`h-4 w-4 ${isRTL ? 'mr-2' : 'ml-2'} ${isRTL ? 'icon-flip' : ''}`}
              />
            </Button>

            <Button variant="secondary">
              <DirectionalText>Mixed Content Button</DirectionalText>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Example */}
      <Card>
        <CardHeader>
          <CardTitle className="text-natural">Form Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-2 text-natural">
                Teacher Name / نام معلم
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded-md text-natural"
                placeholder={isRTL ? 'نام معلم را وارد کنید' : 'Enter teacher name'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-natural">
                Subject Count / تعداد درس
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md number-ltr"
                placeholder="5"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
