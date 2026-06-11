Pod::Spec.new do |s|
  s.name           = 'SillageMusic'
  s.version        = '1.0.0'
  s.summary        = 'Pont MusicKit pour Sillage'
  s.description    = 'Lecture Apple Music (MusicKit) pour la mise en ondes Sillage.'
  s.author         = 'Sillage'
  s.homepage       = 'https://github.com/Pauldemoon/sillage'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
