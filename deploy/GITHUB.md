# نشر Dailgo من GitHub إلى dailgo.decoderz.dev

الهدف: Ubuntu 24.04 على `94.237.30.56`، والدومين `dailgo.decoderz.dev`.
هذا السيرفر عليه مشاريع أخرى. ابدأ بالفحص فقط؛ لا تشغّل إعداد الخدمة قبل مراجعة النتائج.
التعديلات الحالية لا تعني أن SSH أو DNS أو HTTPS أو GitHub Secrets جاهزة.

## 1. فحص السيرفر أولًا

من جلسة SSH الإدارية الحالية شغّل `bash deploy/inspect-vps.sh` من نسخة الملفات.
السكربت للقراءة فقط: النظام، الأدوات، المنافذ، أسماء مواقع Nginx وبصمات SSH العامة.
لا يعرض ملفات الأسرار أو مفاتيح خاصة أو إعدادات المواقع كاملة.
راجع المنفذ 8787 والمسارات `/srv/personal-os` و`/var/lib/personal-os` وحسابات الخدمة.
لو مستخدمة، توقف لتعديل التصميم بدل استبدال مشروع قائم.
لا تغيّر SSH أو firewall أو Docker أو خدمات المشاريع الأخرى.

## 2. GitHub يبني ويختبر قبل النشر

ملف `.github/workflows/dailgo.yml` يعمل مع Pull Requests وpush إلى `main` وفروع
`codex/**`، أو يدويًا من Actions. يشغّل اختبارات المنطق والسيرفر والنشر والمتصفح، ثم
ينتج Artifact باسم `dailgo-COMMIT` يحتوي `dailgo.tar.gz` وبصمته.
النشر مسموح من `main` فقط، ومقفول افتراضيًا حتى تضبط متغير المستودع
`DAILGO_DEPLOY_ENABLED=true`. الفرع وحده لا ينشر ولا يلمس السيرفر.
الحزمة لا تحتوي حسابات أو قواعد بيانات أو `node_modules` أو أسرار.

نزّل Artifact لأول تجهيز، وافحص `sha256sum -c dailgo.tar.gz.sha256`، ثم فكّه **كمستخدم
غير root** في مجلد فارغ وافحص `sha256sum -c SHA256SUMS` داخله. راجع السكربتات
قبل تنفيذ إعداد root. النشر الآلي اللاحق يرفع الحزمة فقط؛ السيرفر لا يحتاج GitHub token
أو نسخة Git من المستودع. لا ترفع نسخة قاعدة التطوير.

## 3. Node منفصل عن المشاريع الأخرى

خدمة Dailgo تستخدم `/opt/dailgo/node/bin/node`؛ لا يستبدل إعدادها Node الخاص بأي مشروع.
بعد الفحص، يمكن للمشرف تثبيت Node 24 الموثق هناك. مثال على Ubuntu amd64/arm64،
يُنفّذ على السيرفر في مجلد عمل خاص فارغ:

```sh
set -eu
case "$(uname -m)" in
  x86_64) node_arch=x64 ;;
  aarch64) node_arch=arm64 ;;
  *) echo 'Unsupported architecture'; exit 1 ;;
esac
node_version=24.19.0
node_archive="node-v${node_version}-linux-${node_arch}.tar.xz"
curl --fail --show-error --location --proto '=https' --tlsv1.2 \
  "https://nodejs.org/dist/v${node_version}/${node_archive}" -o "$node_archive"
curl --fail --show-error --location --proto '=https' --tlsv1.2 \
  "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt" -o SHASUMS256.txt
awk -v name="$node_archive" '$2 == name {print}' SHASUMS256.txt > node.sha256
test "$(wc -l < node.sha256)" -eq 1
sha256sum -c node.sha256
test ! -e /opt/dailgo/node
# Stop and inspect if /opt/dailgo or this version already contains unrelated files.
test ! -e "/opt/dailgo/node-v${node_version}-linux-${node_arch}"
sudo install -d -m 755 /opt/dailgo
sudo tar --no-same-owner -xJf "$node_archive" -C /opt/dailgo
sudo ln -s "/opt/dailgo/node-v${node_version}-linux-${node_arch}" /opt/dailgo/node
/opt/dailgo/node/bin/node --version
/opt/dailgo/node/bin/node -e "require('node:sqlite')"
```

لا تعطل TLS أو تتجاوز فشل checksum. السكربتات تفترض وجود Python 3.11+ وcurl وOpenSSH
وsudo وsystemd وNginx. Ubuntu 24.04 يوفر Python 3.12. لا تثبّت أو تغيّر Nginx قبل معرفة
هل المشاريع تستخدم Nginx النظام، أو Docker، أو لوحة تحكم.

## 4. مفتاح نشر مخصص

على جهازك المحلي، أنشئ مفتاحًا مخصصًا بلا passphrase لأتمتة GitHub فقط:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/dailgo-github-actions -C dailgo-github-actions
```

عند السؤال عن passphrase، اتركه فارغًا لهذا المفتاح المخصص. لا تعِد استخدام مفتاحك الإداري.
ارفع **الملف العام `.pub` فقط** إلى مسار مؤقت على السيرفر. لا تضع المفتاح الخاص في Git
أو المحادثة. ضع محتواه مباشرة في GitHub Secret الموضح أدناه.

بعد مراجعة الفحص والسكربتات، من مجلد الحزمة على السيرفر:

```sh
sudo bash deploy/bootstrap-deploy.sh /absolute/path/to/dailgo-github-actions.pub
```

الإعداد يرفض الحسابات أو المسارات الموجودة أو المنفذ المشغول بدل الكتابة فوقها. ينشئ:

- مستخدم تشغيل `personal-os` بلا shell، وبيانات خاصة `/var/lib/personal-os`.
- مستخدم رفع `dailgo-deploy` بمفتاح `restrict`، وبدون forwarding أو PTY.
- مجلد إصدارات root-owned `/srv/personal-os/releases`، لا يكتب فيه مستخدم الرفع أو التطبيق.
- helper موثوق `/usr/local/sbin/dailgo-release`؛ صلاحية sudo تقتصر عليه، بلا sudo عام.
- خدمة التطبيق ونسخة احتياطية ومؤقت منفصلين. لا يبدأ التطبيق أو يعيد تشغيل Nginx أثناء الإعداد.
- `/etc/personal-os.env` بصلاحية 0600، مع الدومين وقاعدة البيانات ورمز تهيئة عشوائي لا يطبع.

الرمز مطلوب لإنشاء حسابك الأول. اطّلع عليه داخل جلسة الإدارة الخاصة على السيرفر عند الحاجة،
ولا ترسله في المحادثة أو تضفه إلى رابط. المفتاح المخصص يتيح نشر كود يعمل بصلاحية خدمة
التطبيق، وبالتالي الوصول إلى بياناتها؛ احمِ GitHub Secrets وصلاحيات المستودع.
تحديث helper نفسه يحتاج مراجعة وتركيبًا إداريًا؛ الإصدارات المرفوعة لا تغيّره تلقائيًا.
إذا انقطع bootstrap بعد إنشاء بعض الموارد، افحصها ولا تحذفها عشوائيًا لإعادة التشغيل.

## 5. DNS وHTTPS دون تعديل المواقع الأخرى

سجل A لـ`dailgo.decoderz.dev` يشير إلى `94.237.30.56`. لا تضف AAAA إلا لو IPv6 جاهز.
راجع تعليمات Nginx في `deploy/VPS.md`. أنشئ **ملف موقع جديدًا** لهذا الدومين، باستخدام
قالب bootstrap ثم قالب HTTPS بعد إصدار الشهادة، مع استبدال `assistant.example.com`
بـ`dailgo.decoderz.dev`. لا تستبدل nginx.conf أو ملفات مشاريع أخرى، وافحص `nginx -t`
قبل reload. لو الموقع خلف Docker أو لوحة تحكم، استخدم المسار المناسب بعد الفحص بدل
ربط ملفات Nginx النظام تلقائيًا. منفذ Node يبقى loopback، ولا يُفتح للعامة.
يمكن إصدار الشهادة عبر مسار ACME قبل أول نشر حتى لو التطبيق لم يبدأ بعد.

## 6. إعداد GitHub

من Settings → Environments، أنشئ `production` وحدّد `main` كفرع نشر مسموح.
من Settings → Secrets and variables → Actions:

| النوع                                      | الاسم                    | القيمة                                      |
| ------------------------------------------ | ------------------------ | ------------------------------------------- |
| Repository variable                        | `DAILGO_DEPLOY_ENABLED`  | اتركه `false` حتى تكتمل الخطوات، ثم `true`  |
| Production variable أو Repository variable | `DAILGO_SSH_HOST`        | `94.237.30.56`                              |
| Production variable أو Repository variable | `DAILGO_SSH_PORT`        | `22` أو منفذ SSH الفعلي                     |
| Production secret                          | `DAILGO_SSH_PRIVATE_KEY` | المفتاح الخاص المخصص، تدخله بنفسك في GitHub |
| Production secret                          | `DAILGO_SSH_KNOWN_HOSTS` | سطر host key الموثوق للسيرفر                |

لتحضير known_hosts، اجمع المفتاح العام بـ`ssh-keyscan -p PORT -t ed25519 HOST` على
جهازك، وقارن بصمته مع بصمة `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
من جلسة السيرفر الموثوقة أو لوحة المزود. بعد التطابق فقط ضعه في Secret. للمنفذ غير 22
يلزم الشكل `[HOST]:PORT` في known_hosts. لا تعتمد على keyscan وحده ولا تعطل فحص المضيف.
لا يحتاج النشر PAT داخل السيرفر. مستخدم النشر ثابت `dailgo-deploy`.

## 7. أول نشر وما بعده

بعد دمج التعديلات إلى `main` واستكمال الإعداد، اضبط `DAILGO_DEPLOY_ENABLED=true`، ثم
شغّل Actions → Dailgo checks and deployment → Run workflow على `main`.
بعدها كل push إلى `main` يمر بالاختبارات ثم النشر. عمليات النشر متسلسلة ولا تُلغى
عملية قائمة لصالح push جديد. بعد أول نجاح شغّل:

```sh
sudo systemctl enable --now personal-os-backup.timer
```

الـhelper يفحص بصمة الأرشيف وكل الملفات، ويرفض traversal والروابط والملفات الخاصة،
ويطابق commit الحزمة. ثم يشغّل backup قبل لمس نسخة قائمة، ويبدّل رابط `current` ذريًا،
ويعيد تشغيل `personal-os` فقط. فشل restart أو فحص الصحة المحلي يعيد رابط الإصدار السابق
ويعيد تشغيله؛ قاعدة البيانات لا تُرجع للخلف تلقائيًا. عند فشل أول نشر يتوقف التطبيق فقط.
فحص الإصدار الجديد يتأكد من صحة API وcommit عبر `/release.json` لمنع نجاح فحص نسخة قديمة.
فشل backup يوقف النشر ويحافظ على الإصدار القائم.

GitHub يفحص HTTPS والدومين وcommit بعد النشر أيضًا. فشل الفحص الخارجي يفشل الـjob؛
لا يغيّر DNS أو Nginx ولا يرجع تلقائيًا إصدارًا سليمًا محليًا بسبب مشكلة شبكة خارجية.
راجع سجلات `personal-os` وDNS والشهادة في هذه الحالة.

للرجوع اليدوي الإداري إلى آخر إصدار ناجح سابق، افحص الرابط أولًا وخذ backup، ثم:

```sh
sudo systemctl start personal-os-backup.service
previous_release=$(sudo readlink -e /srv/personal-os/previous)
test -n "$previous_release"
test ! -e /srv/personal-os/current.rollback
test ! -L /srv/personal-os/current.rollback
sudo ln -s "$previous_release" /srv/personal-os/current.rollback
sudo mv -Tf /srv/personal-os/current.rollback /srv/personal-os/current
sudo systemctl restart personal-os
```

افحص الصحة وHTTPS بعد الرجوع. الإصدارات والملفات المرفوعة والنسخ الاحتياطية تُحتفظ؛
راقب مساحة القرص 30GB واحذف القديم إداريًا بعد التأكد من عدم حذف current أو previous
أو نسخ تحتاجها. لا يوجد حذف أو ترحيل مدمّر تلقائي. النسخ على نفس القرص ليست حماية
من فقد السيرفر؛ يلزم نسخ مستقل خارج السيرفر لاحقًا.

## ما تم اختباره وما لم يتم

`npm run test:deploy` يختبر checksums، رفض traversal والروابط، backup قبل التحديث،
النجاح، وفشل restart والصحة والرجوع، داخل مجلدات مؤقتة وخدمات وهمية فقط.
الاختبارات لا تغيّر systemd أو root أو Nginx الفعليين. فحص YAML وسكربتات shell وحزمة
الإصدار محلي لا يثبت نجاح GitHub Actions أو الاتصال بالـVPS أو صحة الدومين؛ تلك خطوات
تتأكد بعد توفير الوصول والإعدادات.
