# Content review

Every bundled word, sentence and story is listed here for the parent to read through (spec §6.6).
All content was drafted for the app and passes `npm run validate-content`, but a person should still
confirm each segmentation and each sentence. Change `false` to `true` in the last column as you approve
an item. `npm run review-list` regenerates this file and keeps your `true` marks.

Segmentation is written spelling→sound. ♥ marks a part that is irregular by nature.

## Heart words

| id | word | segmentation | starts unlocked | reviewed |
| --- | --- | --- | --- | --- |
| `heart:is` | is | i→i_short · s→z | yes | false |
| `heart:has` | has | h→h · a→a_short · s→z | yes | false |
| `heart:the` | the | th→th_voiced · e→schwa ♥ | yes | false |
| `heart:they` | they | th→th_voiced · ey→a_long ♥ | yes | false |
| `heart:he` | he | h→h · e→e_long ♥ | yes | false |
| `heart:we` | we | w→w · e→e_long ♥ | yes | false |
| `heart:go` | go | g→g · o→o_long ♥ | yes | false |
| `heart:she` | she | sh→sh · e→e_long ♥ | yes | false |
| `heart:see` | see | s→s · ee→e_long ♥ | yes | false |
| `heart:eat` | eat | ea→e_long ♥ · t→t | yes | false |
| `heart:like` | like | l→l · i_e→i_long · k→k | yes | false |
| `heart:her` | her | h→h · er→er ♥ | yes | false |
| `heart:i` | I | I→i_long ♥ | yes | false |
| `heart:a` | a | a→schwa ♥ | yes | false |
| `heart:to` | to | t→t · o→oo ♥ | yes | false |
| `heart:was` | was | w→w · a→schwa ♥ · s→z | yes | false |
| `heart:are` | are | are→ar ♥ | yes | false |
| `heart:down` | down | d→d · ow→ow ♥ · n→n | yes | false |
| `heart:friend` | friend | f→f · r→r · ie→e_short ♥ · n→n · d→d | yes | false |
| `heart:star` | star | s→s · t→t · ar→ar ♥ | no (interest word) | false |
| `heart:moon` | moon | m→m · oo→oo ♥ · n→n | no (interest word) | false |
| `heart:fairy` | fairy | f→f · air→air ♥ · y→e_long ♥ | no (interest word) | false |
| `heart:princess` | princess | p→p · r→r · i→i_short · n→n · c→s ♥ · e→e_short · ss→s ♥ | no (interest word) | false |

## Level 1 words: Short a, i (74)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:at` | at | a→a_short · t→t |  | false |
| `word:bat` | bat | b→b · a→a_short · t→t | bat | false |
| `word:cat` | cat | c→k · a→a_short · t→t | cat | false |
| `word:fat` | fat | f→f · a→a_short · t→t |  | false |
| `word:hat` | hat | h→h · a→a_short · t→t | hat | false |
| `word:mat` | mat | m→m · a→a_short · t→t | mat | false |
| `word:pat` | pat | p→p · a→a_short · t→t |  | false |
| `word:rat` | rat | r→r · a→a_short · t→t | rat | false |
| `word:sat` | sat | s→s · a→a_short · t→t |  | false |
| `word:an` | an | a→a_short · n→n |  | false |
| `word:can` | can | c→k · a→a_short · n→n | can | false |
| `word:fan` | fan | f→f · a→a_short · n→n | fan | false |
| `word:man` | man | m→m · a→a_short · n→n | man | false |
| `word:pan` | pan | p→p · a→a_short · n→n | pan | false |
| `word:ran` | ran | r→r · a→a_short · n→n |  | false |
| `word:tan` | tan | t→t · a→a_short · n→n |  | false |
| `word:cap` | cap | c→k · a→a_short · p→p | cap | false |
| `word:gap` | gap | g→g · a→a_short · p→p |  | false |
| `word:lap` | lap | l→l · a→a_short · p→p |  | false |
| `word:map` | map | m→m · a→a_short · p→p | map | false |
| `word:nap` | nap | n→n · a→a_short · p→p |  | false |
| `word:tap` | tap | t→t · a→a_short · p→p |  | false |
| `word:zap` | zap | z→z · a→a_short · p→p |  | false |
| `word:bad` | bad | b→b · a→a_short · d→d |  | false |
| `word:dad` | dad | d→d · a→a_short · d→d | dad | false |
| `word:had` | had | h→h · a→a_short · d→d |  | false |
| `word:mad` | mad | m→m · a→a_short · d→d |  | false |
| `word:pad` | pad | p→p · a→a_short · d→d |  | false |
| `word:sad` | sad | s→s · a→a_short · d→d |  | false |
| `word:bag` | bag | b→b · a→a_short · g→g | bag | false |
| `word:rag` | rag | r→r · a→a_short · g→g |  | false |
| `word:tag` | tag | t→t · a→a_short · g→g |  | false |
| `word:am` | am | a→a_short · m→m |  | false |
| `word:ham` | ham | h→h · a→a_short · m→m |  | false |
| `word:ram` | ram | r→r · a→a_short · m→m | ram | false |
| `word:pam` | pam | p→p · a→a_short · m→m |  | false |
| `word:sam` | sam | s→s · a→a_short · m→m |  | false |
| `word:cab` | cab | c→k · a→a_short · b→b |  | false |
| `word:lab` | lab | l→l · a→a_short · b→b |  | false |
| `word:tab` | tab | t→t · a→a_short · b→b |  | false |
| `word:gas` | gas | g→g · a→a_short · s→s |  | false |
| `word:pal` | pal | p→p · a→a_short · l→l |  | false |
| `word:it` | it | i→i_short · t→t |  | false |
| `word:bit` | bit | b→b · i→i_short · t→t |  | false |
| `word:fit` | fit | f→f · i→i_short · t→t |  | false |
| `word:hit` | hit | h→h · i→i_short · t→t |  | false |
| `word:lit` | lit | l→l · i→i_short · t→t |  | false |
| `word:pit` | pit | p→p · i→i_short · t→t |  | false |
| `word:sit` | sit | s→s · i→i_short · t→t |  | false |
| `word:in` | in | i→i_short · n→n |  | false |
| `word:bin` | bin | b→b · i→i_short · n→n | bin | false |
| `word:fin` | fin | f→f · i→i_short · n→n |  | false |
| `word:pin` | pin | p→p · i→i_short · n→n | pin | false |
| `word:tin` | tin | t→t · i→i_short · n→n |  | false |
| `word:dip` | dip | d→d · i→i_short · p→p |  | false |
| `word:hip` | hip | h→h · i→i_short · p→p |  | false |
| `word:lip` | lip | l→l · i→i_short · p→p |  | false |
| `word:rip` | rip | r→r · i→i_short · p→p |  | false |
| `word:sip` | sip | s→s · i→i_short · p→p |  | false |
| `word:tip` | tip | t→t · i→i_short · p→p |  | false |
| `word:zip` | zip | z→z · i→i_short · p→p |  | false |
| `word:big` | big | b→b · i→i_short · g→g |  | false |
| `word:dig` | dig | d→d · i→i_short · g→g |  | false |
| `word:fig` | fig | f→f · i→i_short · g→g |  | false |
| `word:pig` | pig | p→p · i→i_short · g→g | pig | false |
| `word:did` | did | d→d · i→i_short · d→d |  | false |
| `word:hid` | hid | h→h · i→i_short · d→d |  | false |
| `word:lid` | lid | l→l · i→i_short · d→d | lid | false |
| `word:dim` | dim | d→d · i→i_short · m→m |  | false |
| `word:him` | him | h→h · i→i_short · m→m |  | false |
| `word:rim` | rim | r→r · i→i_short · m→m |  | false |
| `word:bib` | bib | b→b · i→i_short · b→b |  | false |
| `word:rib` | rib | r→r · i→i_short · b→b |  | false |
| `word:if` | if | i→i_short · f→f |  | false |

## Level 2 words: Short o (27)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:on` | on | o→o_short · n→n |  | false |
| `word:not` | not | n→n · o→o_short · t→t |  | false |
| `word:hot` | hot | h→h · o→o_short · t→t |  | false |
| `word:pot` | pot | p→p · o→o_short · t→t | pot | false |
| `word:dot` | dot | d→d · o→o_short · t→t | dot | false |
| `word:got` | got | g→g · o→o_short · t→t |  | false |
| `word:lot` | lot | l→l · o→o_short · t→t |  | false |
| `word:cot` | cot | c→k · o→o_short · t→t |  | false |
| `word:hop` | hop | h→h · o→o_short · p→p |  | false |
| `word:mop` | mop | m→m · o→o_short · p→p | mop | false |
| `word:top` | top | t→t · o→o_short · p→p |  | false |
| `word:pop` | pop | p→p · o→o_short · p→p |  | false |
| `word:dog` | dog | d→d · o→o_short · g→g | dog | false |
| `word:hog` | hog | h→h · o→o_short · g→g | hog | false |
| `word:log` | log | l→l · o→o_short · g→g | log | false |
| `word:fog` | fog | f→f · o→o_short · g→g |  | false |
| `word:mom` | mom | m→m · o→o_short · m→m | mom | false |
| `word:tom` | tom | t→t · o→o_short · m→m |  | false |
| `word:bob` | bob | b→b · o→o_short · b→b |  | false |
| `word:cob` | cob | c→k · o→o_short · b→b |  | false |
| `word:sob` | sob | s→s · o→o_short · b→b |  | false |
| `word:rob` | rob | r→r · o→o_short · b→b |  | false |
| `word:nod` | nod | n→n · o→o_short · d→d |  | false |
| `word:rod` | rod | r→r · o→o_short · d→d |  | false |
| `word:pod` | pod | p→p · o→o_short · d→d | pod | false |
| `word:cod` | cod | c→k · o→o_short · d→d |  | false |
| `word:bot` | bot | b→b · o→o_short · t→t | bot | false |

## Level 3 words: ch, th (13)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:chip` | chip | ch→ch · i→i_short · p→p | chip | false |
| `word:chat` | chat | ch→ch · a→a_short · t→t |  | false |
| `word:chin` | chin | ch→ch · i→i_short · n→n |  | false |
| `word:chop` | chop | ch→ch · o→o_short · p→p |  | false |
| `word:rich` | rich | r→r · i→i_short · ch→ch |  | false |
| `word:this` | this | th→th_voiced · i→i_short · s→s |  | false |
| `word:that` | that | th→th_voiced · a→a_short · t→t |  | false |
| `word:than` | than | th→th_voiced · a→a_short · n→n |  | false |
| `word:thin` | thin | th→th_unvoiced · i→i_short · n→n |  | false |
| `word:math` | math | m→m · a→a_short · th→th_unvoiced |  | false |
| `word:bath` | bath | b→b · a→a_short · th→th_unvoiced | bath | false |
| `word:path` | path | p→p · a→a_short · th→th_unvoiced |  | false |
| `word:moth` | moth | m→m · o→o_short · th→th_unvoiced |  | false |

## Level 4 words: Ending -s (43)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:cats` | cats | c→k · a→a_short · t→t · s→s |  | false |
| `word:hats` | hats | h→h · a→a_short · t→t · s→s |  | false |
| `word:bats` | bats | b→b · a→a_short · t→t · s→s |  | false |
| `word:rats` | rats | r→r · a→a_short · t→t · s→s |  | false |
| `word:mats` | mats | m→m · a→a_short · t→t · s→s |  | false |
| `word:maps` | maps | m→m · a→a_short · p→p · s→s |  | false |
| `word:caps` | caps | c→k · a→a_short · p→p · s→s |  | false |
| `word:naps` | naps | n→n · a→a_short · p→p · s→s |  | false |
| `word:taps` | taps | t→t · a→a_short · p→p · s→s |  | false |
| `word:pats` | pats | p→p · a→a_short · t→t · s→s |  | false |
| `word:sits` | sits | s→s · i→i_short · t→t · s→s |  | false |
| `word:hits` | hits | h→h · i→i_short · t→t · s→s |  | false |
| `word:tips` | tips | t→t · i→i_short · p→p · s→s |  | false |
| `word:sips` | sips | s→s · i→i_short · p→p · s→s |  | false |
| `word:dips` | dips | d→d · i→i_short · p→p · s→s |  | false |
| `word:digs` | digs | d→d · i→i_short · g→g · s→z |  | false |
| `word:pigs` | pigs | p→p · i→i_short · g→g · s→z |  | false |
| `word:pins` | pins | p→p · i→i_short · n→n · s→z |  | false |
| `word:bins` | bins | b→b · i→i_short · n→n · s→z |  | false |
| `word:bags` | bags | b→b · a→a_short · g→g · s→z |  | false |
| `word:pans` | pans | p→p · a→a_short · n→n · s→z |  | false |
| `word:fans` | fans | f→f · a→a_short · n→n · s→z |  | false |
| `word:cans` | cans | c→k · a→a_short · n→n · s→z |  | false |
| `word:dads` | dads | d→d · a→a_short · d→d · s→z |  | false |
| `word:pals` | pals | p→p · a→a_short · l→l · s→z |  | false |
| `word:hops` | hops | h→h · o→o_short · p→p · s→s |  | false |
| `word:pops` | pops | p→p · o→o_short · p→p · s→s |  | false |
| `word:tops` | tops | t→t · o→o_short · p→p · s→s |  | false |
| `word:pots` | pots | p→p · o→o_short · t→t · s→s |  | false |
| `word:dots` | dots | d→d · o→o_short · t→t · s→s |  | false |
| `word:mops` | mops | m→m · o→o_short · p→p · s→s |  | false |
| `word:dogs` | dogs | d→d · o→o_short · g→g · s→z |  | false |
| `word:hogs` | hogs | h→h · o→o_short · g→g · s→z |  | false |
| `word:logs` | logs | l→l · o→o_short · g→g · s→z |  | false |
| `word:moms` | moms | m→m · o→o_short · m→m · s→z |  | false |
| `word:nods` | nods | n→n · o→o_short · d→d · s→z |  | false |
| `word:pods` | pods | p→p · o→o_short · d→d · s→z |  | false |
| `word:bots` | bots | b→b · o→o_short · t→t · s→s |  | false |
| `word:chips` | chips | ch→ch · i→i_short · p→p · s→s |  | false |
| `word:chops` | chops | ch→ch · o→o_short · p→p · s→s |  | false |
| `word:chats` | chats | ch→ch · a→a_short · t→t · s→s |  | false |
| `word:his` | his | h→h · i→i_short · s→z |  | false |
| `word:as` | as | a→a_short · s→z |  | false |

## Level 5 words: sh (14)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:ship` | ship | sh→sh · i→i_short · p→p | ship | false |
| `word:shop` | shop | sh→sh · o→o_short · p→p | shop | false |
| `word:shot` | shot | sh→sh · o→o_short · t→t |  | false |
| `word:shin` | shin | sh→sh · i→i_short · n→n |  | false |
| `word:fish` | fish | f→f · i→i_short · sh→sh | fish | false |
| `word:dish` | dish | d→d · i→i_short · sh→sh | dish | false |
| `word:dash` | dash | d→d · a→a_short · sh→sh |  | false |
| `word:cash` | cash | c→k · a→a_short · sh→sh | cash | false |
| `word:mash` | mash | m→m · a→a_short · sh→sh |  | false |
| `word:rash` | rash | r→r · a→a_short · sh→sh |  | false |
| `word:bash` | bash | b→b · a→a_short · sh→sh |  | false |
| `word:gosh` | gosh | g→g · o→o_short · sh→sh |  | false |
| `word:ships` | ships | sh→sh · i→i_short · p→p · s→s |  | false |
| `word:shops` | shops | sh→sh · o→o_short · p→p · s→s |  | false |

## Level 6 words: Short u, e (44)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:sun` | sun | s→s · u→u_short · n→n | sun | false |
| `word:run` | run | r→r · u→u_short · n→n |  | false |
| `word:fun` | fun | f→f · u→u_short · n→n |  | false |
| `word:bun` | bun | b→b · u→u_short · n→n |  | false |
| `word:bug` | bug | b→b · u→u_short · g→g | bug | false |
| `word:hug` | hug | h→h · u→u_short · g→g |  | false |
| `word:mug` | mug | m→m · u→u_short · g→g |  | false |
| `word:rug` | rug | r→r · u→u_short · g→g |  | false |
| `word:dug` | dug | d→d · u→u_short · g→g |  | false |
| `word:cub` | cub | c→k · u→u_short · b→b |  | false |
| `word:tub` | tub | t→t · u→u_short · b→b |  | false |
| `word:rub` | rub | r→r · u→u_short · b→b |  | false |
| `word:pup` | pup | p→p · u→u_short · p→p |  | false |
| `word:cup` | cup | c→k · u→u_short · p→p | cup | false |
| `word:up` | up | u→u_short · p→p |  | false |
| `word:us` | us | u→u_short · s→s |  | false |
| `word:bus` | bus | b→b · u→u_short · s→s | bus | false |
| `word:mud` | mud | m→m · u→u_short · d→d |  | false |
| `word:nut` | nut | n→n · u→u_short · t→t | nut | false |
| `word:hut` | hut | h→h · u→u_short · t→t |  | false |
| `word:cut` | cut | c→k · u→u_short · t→t |  | false |
| `word:but` | but | b→b · u→u_short · t→t |  | false |
| `word:gum` | gum | g→g · u→u_short · m→m |  | false |
| `word:hum` | hum | h→h · u→u_short · m→m |  | false |
| `word:bed` | bed | b→b · e→e_short · d→d | bed | false |
| `word:red` | red | r→r · e→e_short · d→d |  | false |
| `word:fed` | fed | f→f · e→e_short · d→d |  | false |
| `word:hen` | hen | h→h · e→e_short · n→n | hen | false |
| `word:pen` | pen | p→p · e→e_short · n→n | pen | false |
| `word:ten` | ten | t→t · e→e_short · n→n |  | false |
| `word:men` | men | m→m · e→e_short · n→n |  | false |
| `word:pet` | pet | p→p · e→e_short · t→t |  | false |
| `word:net` | net | n→n · e→e_short · t→t |  | false |
| `word:set` | set | s→s · e→e_short · t→t |  | false |
| `word:get` | get | g→g · e→e_short · t→t |  | false |
| `word:let` | let | l→l · e→e_short · t→t |  | false |
| `word:met` | met | m→m · e→e_short · t→t |  | false |
| `word:leg` | leg | l→l · e→e_short · g→g | leg | false |
| `word:beg` | beg | b→b · e→e_short · g→g |  | false |
| `word:them` | them | th→th_voiced · e→e_short · m→m |  | false |
| `word:then` | then | th→th_voiced · e→e_short · n→n |  | false |
| `word:shed` | shed | sh→sh · e→e_short · d→d |  | false |
| `word:much` | much | m→m · u→u_short · ch→ch |  | false |
| `word:such` | such | s→s · u→u_short · ch→ch |  | false |

## Level 7 words: Blends (32)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:and` | and | a→a_short · n→n · d→d (+ blend_final) |  | false |
| `word:stop` | stop | s→s · t→t · o→o_short · p→p (+ blend_initial) |  | false |
| `word:pond` | pond | p→p · o→o_short · n→n · d→d (+ blend_final) |  | false |
| `word:hand` | hand | h→h · a→a_short · n→n · d→d (+ blend_final) | hand | false |
| `word:sand` | sand | s→s · a→a_short · n→n · d→d (+ blend_final) |  | false |
| `word:land` | land | l→l · a→a_short · n→n · d→d (+ blend_final) |  | false |
| `word:spot` | spot | s→s · p→p · o→o_short · t→t (+ blend_initial) |  | false |
| `word:spin` | spin | s→s · p→p · i→i_short · n→n (+ blend_initial) |  | false |
| `word:flag` | flag | f→f · l→l · a→a_short · g→g (+ blend_initial) | flag | false |
| `word:flip` | flip | f→f · l→l · i→i_short · p→p (+ blend_initial) |  | false |
| `word:frog` | frog | f→f · r→r · o→o_short · g→g (+ blend_initial) | frog | false |
| `word:grab` | grab | g→g · r→r · a→a_short · b→b (+ blend_initial) |  | false |
| `word:grin` | grin | g→g · r→r · i→i_short · n→n (+ blend_initial) |  | false |
| `word:trip` | trip | t→t · r→r · i→i_short · p→p (+ blend_initial) |  | false |
| `word:drip` | drip | d→d · r→r · i→i_short · p→p (+ blend_initial) |  | false |
| `word:drop` | drop | d→d · r→r · o→o_short · p→p (+ blend_initial) |  | false |
| `word:crab` | crab | c→k · r→r · a→a_short · b→b (+ blend_initial) | crab | false |
| `word:clap` | clap | c→k · l→l · a→a_short · p→p (+ blend_initial) |  | false |
| `word:plan` | plan | p→p · l→l · a→a_short · n→n (+ blend_initial) |  | false |
| `word:slip` | slip | s→s · l→l · i→i_short · p→p (+ blend_initial) |  | false |
| `word:sled` | sled | s→s · l→l · e→e_short · d→d (+ blend_initial) | sled | false |
| `word:snap` | snap | s→s · n→n · a→a_short · p→p (+ blend_initial) |  | false |
| `word:fast` | fast | f→f · a→a_short · s→s · t→t (+ blend_final) |  | false |
| `word:last` | last | l→l · a→a_short · s→s · t→t (+ blend_final) |  | false |
| `word:list` | list | l→l · i→i_short · s→s · t→t (+ blend_final) |  | false |
| `word:nest` | nest | n→n · e→e_short · s→s · t→t (+ blend_final) |  | false |
| `word:best` | best | b→b · e→e_short · s→s · t→t (+ blend_final) |  | false |
| `word:rest` | rest | r→r · e→e_short · s→s · t→t (+ blend_final) |  | false |
| `word:lamp` | lamp | l→l · a→a_short · m→m · p→p (+ blend_final) |  | false |
| `word:camp` | camp | c→k · a→a_short · m→m · p→p (+ blend_final) |  | false |
| `word:ant` | ant | a→a_short · n→n · t→t (+ blend_final) | ant | false |
| `word:tent` | tent | t→t · e→e_short · n→n · t→t (+ blend_final) | tent | false |

## Level 8 words: ck, wh, silent-e (32)

| id | word | segmentation | picture | reviewed |
| --- | --- | --- | --- | --- |
| `word:duck` | duck | d→d · u→u_short · ck→k | duck | false |
| `word:sock` | sock | s→s · o→o_short · ck→k | sock | false |
| `word:rock` | rock | r→r · o→o_short · ck→k | rock | false |
| `word:back` | back | b→b · a→a_short · ck→k |  | false |
| `word:pick` | pick | p→p · i→i_short · ck→k |  | false |
| `word:neck` | neck | n→n · e→e_short · ck→k |  | false |
| `word:chick` | chick | ch→ch · i→i_short · ck→k | chick | false |
| `word:thick` | thick | th→th_unvoiced · i→i_short · ck→k |  | false |
| `word:when` | when | wh→w · e→e_short · n→n |  | false |
| `word:whip` | whip | wh→w · i→i_short · p→p |  | false |
| `word:game` | game | g→g · a_e→a_long · m→m | game | false |
| `word:name` | name | n→n · a_e→a_long · m→m |  | false |
| `word:tape` | tape | t→t · a_e→a_long · p→p |  | false |
| `word:cape` | cape | c→k · a_e→a_long · p→p |  | false |
| `word:gate` | gate | g→g · a_e→a_long · t→t |  | false |
| `word:late` | late | l→l · a_e→a_long · t→t |  | false |
| `word:same` | same | s→s · a_e→a_long · m→m |  | false |
| `word:made` | made | m→m · a_e→a_long · d→d |  | false |
| `word:time` | time | t→t · i_e→i_long · m→m |  | false |
| `word:dime` | dime | d→d · i_e→i_long · m→m |  | false |
| `word:pine` | pine | p→p · i_e→i_long · n→n |  | false |
| `word:hide` | hide | h→h · i_e→i_long · d→d |  | false |
| `word:ride` | ride | r→r · i_e→i_long · d→d |  | false |
| `word:side` | side | s→s · i_e→i_long · d→d |  | false |
| `word:fine` | fine | f→f · i_e→i_long · n→n |  | false |
| `word:bone` | bone | b→b · o_e→o_long · n→n | bone | false |
| `word:home` | home | h→h · o_e→o_long · m→m | home | false |
| `word:rope` | rope | r→r · o_e→o_long · p→p |  | false |
| `word:hope` | hope | h→h · o_e→o_long · p→p |  | false |
| `word:note` | note | n→n · o_e→o_long · t→t |  | false |
| `word:cube` | cube | c→k · u_e→u_long · b→b | cube | false |
| `word:tube` | tube | t→t · u_e→u_long · b→b |  | false |

## Sentences (103)

| id | level | sentence | scene | reviewed |
| --- | --- | --- | --- | --- |
| `sentence:s001` | 1 | The cat sat in a bag. | cat in bag | false |
| `sentence:s002` | 1 | The pig is in a pan. | pig in pan | false |
| `sentence:s003` | 1 | The rat has a hat. | rat with hat | false |
| `sentence:s004` | 1 | A bat is in a cap. | bat in cap | false |
| `sentence:s005` | 1 | The cat has a map. | cat with map | false |
| `sentence:s006` | 1 | The rat is in a can. | rat in can | false |
| `sentence:s007` | 1 | A pig sat in a bin. | pig in bin | false |
| `sentence:s008` | 1 | I see a big pig. | pig | false |
| `sentence:s009` | 1 | The ram has a bag. | ram with bag | false |
| `sentence:s010` | 1 | Dad has a tan hat. | dad with hat | false |
| `sentence:s011` | 1 | The man has a fan. | man with fan | false |
| `sentence:s012` | 1 | The cat is sad. |  | false |
| `sentence:s013` | 1 | Pam has a big bag. |  | false |
| `sentence:s014` | 1 | Sam can tap a pan. |  | false |
| `sentence:s015` | 1 | The bat is in a hat. | bat in hat | false |
| `sentence:s016` | 1 | I see a rat in a cap. | rat in cap | false |
| `sentence:s017` | 1 | The pig hid in a bag. | pig in bag | false |
| `sentence:s018` | 1 | She has a pin. |  | false |
| `sentence:s019` | 1 | We like the cat. | cat | false |
| `sentence:s020` | 1 | He can pat the ram. | ram | false |
| `sentence:s021` | 1 | A cat sat in a hat. | cat in hat | false |
| `sentence:s022` | 1 | The ram is big. |  | false |
| `sentence:s023` | 2 | The dog is on a log. | dog on log | false |
| `sentence:s024` | 2 | The cat is on the mat. | cat on mat | false |
| `sentence:s025` | 2 | A dog is in a pot. | dog in pot | false |
| `sentence:s026` | 2 | The bot is in a pod. | bot in pod | false |
| `sentence:s027` | 2 | The bot has a map. | bot with map | false |
| `sentence:s028` | 2 | The dog has a hat. | dog with hat | false |
| `sentence:s029` | 2 | The rat is on a pot. | rat on pot | false |
| `sentence:s030` | 2 | A cat is on the bot. | cat on bot | false |
| `sentence:s031` | 2 | The hog is on a log. | hog on log | false |
| `sentence:s032` | 2 | The pig has a mop. | pig with mop | false |
| `sentence:s033` | 2 | I see a dot. | dot | false |
| `sentence:s034` | 2 | The bot can hop. |  | false |
| `sentence:s035` | 2 | The pod is hot. |  | false |
| `sentence:s036` | 2 | Mom has a pot. | mom with pot | false |
| `sentence:s037` | 2 | Tom got a dog. |  | false |
| `sentence:s038` | 2 | The dog is not sad. |  | false |
| `sentence:s039` | 2 | The cat sat on a lid. | cat on lid | false |
| `sentence:s040` | 2 | A pig is on a mat. | pig on mat | false |
| `sentence:s041` | 2 | The bot is on a log. | bot on log | false |
| `sentence:s042` | 2 | The hog has a cap. | hog with cap | false |
| `sentence:s043` | 2 | Bob has a rod. |  | false |
| `sentence:s044` | 2 | The dog got on a pod. | dog on pod | false |
| `sentence:s045` | 3 | The pig is in the bath. | pig in bath | false |
| `sentence:s046` | 3 | A dog is in a bath. | dog in bath | false |
| `sentence:s047` | 3 | This is a big ram. | ram | false |
| `sentence:s048` | 3 | That is a fat cat. | cat | false |
| `sentence:s049` | 3 | The bat is thin. |  | false |
| `sentence:s050` | 3 | I see a chip on the mat. | chip on mat | false |
| `sentence:s051` | 3 | The rat has a chip. | rat with chip | false |
| `sentence:s052` | 3 | This cat is rich. |  | false |
| `sentence:s053` | 3 | The ram is on a path. |  | false |
| `sentence:s054` | 3 | Pam can chat to Tom. |  | false |
| `sentence:s055` | 3 | I like math. |  | false |
| `sentence:s056` | 3 | That bot is in a bath. | bot in bath | false |
| `sentence:s057` | 3 | The cat has a chip. | cat with chip | false |
| `sentence:s058` | 3 | Chop the log. |  | false |
| `sentence:s059` | 3 | A moth is on that hat. |  | false |
| `sentence:s060` | 4 | The pig sits in a pan. | pig in pan | false |
| `sentence:s061` | 4 | The cat naps on a mat. | cat on mat | false |
| `sentence:s062` | 4 | The rat sits on a hat. | rat on hat | false |
| `sentence:s063` | 4 | The dog digs. |  | false |
| `sentence:s064` | 4 | Pam pats the cat. |  | false |
| `sentence:s065` | 4 | The bot nods. |  | false |
| `sentence:s066` | 4 | She has cats. |  | false |
| `sentence:s067` | 4 | The dogs see the cats. |  | false |
| `sentence:s068` | 4 | The dog sips. |  | false |
| `sentence:s069` | 4 | The bat naps in a cap. | bat in cap | false |
| `sentence:s070` | 4 | The hog sits on a log. | hog on log | false |
| `sentence:s071` | 4 | A dog hops on a pod. | dog on pod | false |
| `sentence:s072` | 5 | The fish is in a dish. | fish in dish | false |
| `sentence:s073` | 5 | The cat is on a ship. | cat on ship | false |
| `sentence:s074` | 5 | The bot is on the ship. | bot on ship | false |
| `sentence:s075` | 5 | The dog is in the shop. | dog in shop | false |
| `sentence:s076` | 5 | A fish is in the pot. | fish in pot | false |
| `sentence:s077` | 5 | She has a fish. |  | false |
| `sentence:s078` | 5 | I see a ship. | ship | false |
| `sentence:s079` | 5 | The pig has cash. | pig with cash | false |
| `sentence:s080` | 5 | Dash to the ship! |  | false |
| `sentence:s081` | 5 | The cat got a fish. | cat with fish | false |
| `sentence:s082` | 5 | The rat is in a dish. | rat in dish | false |
| `sentence:s083` | 5 | The fish is in a bath. | fish in bath | false |
| `sentence:s084` | 1 + star | I see a star. | star | false |
| `sentence:s085` | 2 + moon | The cat is on the moon. | cat on moon | false |
| `sentence:s086` | 2 + moon | The bot is on the moon. | bot on moon | false |
| `sentence:s087` | 1 + fairy | The fairy has a hat. | fairy with hat | false |
| `sentence:s088` | 1 + princess | The princess has a cat. | princess with cat | false |
| `sentence:s089` | 2 + star, fairy | A fairy is on a star. | fairy on star | false |
| `sentence:s090` | 5 + princess | The princess is on the ship. | princess on ship | false |
| `sentence:s091` | 2 + star | The dog is on a star. | dog on star | false |
| `sentence:s092` | 6 | The bug is on a cup. | bug on cup | false |
| `sentence:s093` | 6 | The hen is in the bed. | hen in bed | false |
| `sentence:s094` | 6 | The sun is hot. |  | false |
| `sentence:s095` | 6 | The cat is on the bus. | cat on bus | false |
| `sentence:s096` | 6 | The bug is on a pen. | bug on pen | false |
| `sentence:s097` | 7 | The frog is on a log. | frog on log | false |
| `sentence:s098` | 7 | The crab is in the sand. |  | false |
| `sentence:s099` | 7 | The ant is on a hand. | ant on hand | false |
| `sentence:s100` | 7 | The frog is in a tent. | frog in tent | false |
| `sentence:s101` | 8 | The duck is on a rock. | duck on rock | false |
| `sentence:s102` | 8 | The chick is in a sock. | chick in sock | false |
| `sentence:s103` | 8 | The dog has a bone. | dog with bone | false |

## Stories (23)

| id | level | title and pages | reviewed |
| --- | --- | --- | --- |
| `story:big_pig` | 1 | **A Big Pig**<br>**1.** I see a pig. It is a big pig.<br>**2.** The pig sat in a pit. It is a mad pig.<br>**3.** I can pat the pig. The pig is a pal. | false |
| `story:sad_cat` | 1 | **The Sad Cat**<br>**1.** The cat is sad. The cat has a rip in her hat.<br>**2.** Sam has a pin. Sam can pin the hat.<br>**3.** The cat has her hat. We like the cat! | false |
| `story:bot_in_a_pod` | 2 | **A Bot in a Pod**<br>**1.** The bot is in a pod. The pod is big.<br>**2.** The pod got hot. The bot is not sad.<br>**3.** The bot can see a dot. It is a big, hot dot!<br>**4.** The bot has a map. Go, bot, go! | false |
| `story:dog_on_a_log` | 2 | **A Dog on a Log**<br>**1.** Tom has a dog. The dog is on a log.<br>**2.** The log has a dip. The dog can hop.<br>**3.** Hop, dog, hop! The dog got to Tom. | false |
| `story:hot_pot` | 2 | **The Hot Pot**<br>**1.** Mom has a pot. The pot is hot.<br>**2.** The cat sat on a mat. The cat can see the pot.<br>**3.** Mom has ham in a tin can. The cat got the ham! | false |
| `story:the_dot` | 2 | **The Dot**<br>**1.** I see a dot. Is it a pod?<br>**2.** It is not a pod. It is big. It is hot.<br>**3.** The bot has a map. The bot can see the dot on the map.<br>**4.** We go to the dot. Hop in the pod! | false |
| `story:pig_in_the_bath` | 3 | **The Pig in the Bath**<br>**1.** This is a pig. That is a bath.<br>**2.** The pig got in the bath. The pig can sit.<br>**3.** The bath is hot. The pig is not sad! | false |
| `story:thin_cat` | 3 | **The Thin Cat**<br>**1.** That cat is thin. The cat is on a path.<br>**2.** The path has a chip. The cat got the chip.<br>**3.** This cat is not thin. This cat is fat! | false |
| `story:tin_hat` | 3 | **The Tin Hat**<br>**1.** Pam has a tin hat. It is big.<br>**2.** The cat has the hat. That is not a cat hat!<br>**3.** Pam got a thin hat. This hat can fit the cat. | false |
| `story:dog_digs` | 4 | **The Dog Digs**<br>**1.** The dog digs. He digs in a big pit.<br>**2.** The dog has pots. He has pans.<br>**3.** The dog digs to the top. He naps on a mat. | false |
| `story:pam_pats_the_cat` | 4 | **Pam Pats the Cat**<br>**1.** I see Pam. She has a cat.<br>**2.** The cat sits on the mat. Pam pats the cat.<br>**3.** The cat naps. Pam naps. | false |
| `story:bots_in_pods` | 4 | **Bots in Pods**<br>**1.** The bots hop in the pods. The pods got hot.<br>**2.** The bots see dots. The dots are big!<br>**3.** The bots sit on top. They tap the maps. | false |
| `story:the_ship` | 5 | **The Ship**<br>**1.** The bot has a ship. It is a big ship.<br>**2.** The dog is on the ship. The cat is on the ship.<br>**3.** The ship got to a big dot. Dash to the top, bot!<br>**4.** They see a dish. It has fish in it! | false |
| `story:fish_in_a_dish` | 5 | **A Fish in a Dish**<br>**1.** Pam has a fish. The fish is in a dish.<br>**2.** The cat can see the fish. The cat is on the mat.<br>**3.** Dash, cat, dash! Pam got the dish.<br>**4.** The fish is in the bath. The cat is sad. | false |
| `story:the_shop` | 5 | **The Shop**<br>**1.** Mom has cash. We go to the shop.<br>**2.** The shop has hats. The shop has fish.<br>**3.** I got a big hat. Mom got a fish.<br>**4.** The cat got in the bag. Gosh! | false |
| `story:the_star` | 2 + star | **The Star**<br>**1.** I see a star. It is a big star.<br>**2.** The bot got in a pod. The pod can go to the star.<br>**3.** The star is hot. The bot is not sad.<br>**4.** The bot can see a lot. I like the star! | false |
| `story:to_the_moon` | 2 + moon | **To the Moon**<br>**1.** The dog has a pod. The cat got in the pod.<br>**2.** They go to the moon. The moon is big.<br>**3.** The dog can hop on the moon. The cat can hop on the moon.<br>**4.** Hop, hop, hop! They like the moon. | false |
| `story:the_fairy` | 3 + fairy | **The Fairy**<br>**1.** I see a fairy. She is on a log.<br>**2.** The fairy has a thin rod. She can tap the log.<br>**3.** Tap, tap, tap! The log is a pod.<br>**4.** The fairy got in. Go, fairy, go! | false |
| `story:the_princess` | 2 + princess | **The Princess**<br>**1.** The princess has a cat. The cat has a tin hat.<br>**2.** The princess has a dog. The dog has a big hat.<br>**3.** The princess has a hog. The hog is in the fog.<br>**4.** Hop on, princess! They go to the top. | false |
| `story:princess_on_the_moon` | 2 + star, moon, fairy, princess | **The Princess on the Moon**<br>**1.** The princess is in a pod. The pod can go to the moon.<br>**2.** The moon is big. The princess can hop on it.<br>**3.** She can see a fairy. The fairy is on a star!<br>**4.** The fairy has a map. They go to the top. | false |
| `story:bug_in_the_sun` | 6 | **The Bug in the Sun**<br>**1.** The bug is in the sun. The sun is hot.<br>**2.** The bug got up on a cup. It is fun!<br>**3.** The bug can run. Run, bug, run! | false |
| `story:the_frog` | 7 | **The Frog**<br>**1.** The frog sat on a log. The log is in the pond.<br>**2.** The frog can hop. Hop and stop! Hop and stop!<br>**3.** The frog got to the sand. It naps in the sun. | false |
| `story:the_duck` | 8 | **The Duck**<br>**1.** The duck is on a rock. The rock is in the sun.<br>**2.** The duck has a sock. That is not a duck sock!<br>**3.** The chick got the sock. The chick ran home. | false |
