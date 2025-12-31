import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDirection } from '@/hooks/useDirection';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'fa', name: 'فارسی', nativeName: 'فارسی' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { isRTL } = useDirection();

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Languages className={`h-4 w-4 ${isRTL ? 'icon-flip' : ''}`} />
          <span className="text-natural">{currentLanguage.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`text-natural ${i18n.language === language.code ? 'bg-accent' : ''}`}
          >
            <span className="font-medium">{language.nativeName}</span>
            <span className="text-muted-foreground text-sm">({language.name})</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
