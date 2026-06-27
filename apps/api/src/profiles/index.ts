/**
 * @file index.ts
 * @module Profiles
 * Barrel export for the Profiles module (Sprint 2.4).
 */
export { ProfileModule } from './profiles.module';
export { ProfileService } from './services/profiles.service';
export { ProfileController } from './controllers/profiles.controller';
export type { ProfileDetail, ProfileChangedEvent } from './profiles.types';
export { PROFILE_ERROR_CODES, THEMES, SUPPORTED_LANGUAGES, type Theme, type SupportedLanguage } from './profiles.constants';
export { ProfileErrors } from './profiles.errors';
export {
  UpdateProfileSchema, type UpdateProfileDto,
  UpdateAvatarSchema, type UpdateAvatarDto,
  UpdatePreferencesSchema, type UpdatePreferencesDto,
  UpdateProfileDtoClass, UpdateAvatarDtoClass, UpdatePreferencesDtoClass, ProfileDetailDto,
} from './dto/profile.dto';
