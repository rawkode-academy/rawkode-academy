<template>
  <div :class="sectionStyle">
    <div :class="containerStyle">
      <div :class="innerStyle">
        <h2>Deploy faster</h2>
        <p :class="headlineStyle">Everything you need to deploy your app</p>
        <p :class="descStyle">Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.</p>
      </div>
      <div :class="gridWrapStyle">
        <dl :class="gridStyle">
          <div v-for="feature in features" :key="feature.name" :class="itemStyle">
            <dt :class="dtStyle">
              <div :class="iconWrapStyle">
                <component :is="feature.icon" :class="iconStyle" aria-hidden="true" />
              </div>
              {{ feature.name }}
            </dt>
            <dd :class="ddStyle">{{ feature.description }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
	ArrowPathIcon,
	CloudArrowUpIcon,
	FingerPrintIcon,
	LockClosedIcon,
} from "@heroicons/vue/24/outline";
import { css } from "../../../styled-system/css";

const sectionStyle = css({ bg: { base: 'white', _dark: 'gray.900' }, py: { base: '24', sm: '32' } });
const containerStyle = css({ mx: 'auto', px: '6', lg: { px: '8' } });
const innerStyle = css({ mx: 'auto', lg: { textAlign: 'center' } });
const headlineStyle = css({ mt: '2', fontSize: { base: '3xl', sm: '4xl' }, fontWeight: 'bold', letterSpacing: 'tight', color: 'gray.900' });
const descStyle = css({ mt: '6', fontSize: 'lg', lineHeight: '2rem', color: 'gray.600' });
const gridWrapStyle = css({ mx: 'auto', mt: { base: '16', sm: '20', lg: '24' } });
const gridStyle = css({ display: 'grid', gridTemplateColumns: { base: '1', lg: '2' }, gap: { base: '10', x: '8' }, lg: { gap: '16' } });
const itemStyle = css({ position: 'relative', pl: '16' });
const dtStyle = css({ fontSize: 'base', fontWeight: 'semibold', lineHeight: '1.75rem', color: { base: 'gray.900', _dark: 'white' } });
const iconWrapStyle = css({ position: 'absolute', left: '0', top: '0', display: 'flex', h: '10', w: '10', alignItems: 'center', justifyContent: 'center', borderRadius: 'lg', bg: 'colorPalette.default' });
const iconStyle = css({ h: '6', w: '6', color: 'white' });
const ddStyle = css({ mt: '2', fontSize: 'base', lineHeight: '1.75rem', color: { base: 'gray.600', _dark: 'gray.400' } });

const features = [
	{
		name: "Push to deploy",
		description:
			"Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa.",
		icon: CloudArrowUpIcon,
	},
	{
		name: "SSL certificates",
		description:
			"Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget. Sem sodales gravida quam turpis enim lacus amet.",
		icon: LockClosedIcon,
	},
	{
		name: "Simple queues",
		description:
			"Quisque est vel vulputate cursus. Risus proin diam nunc commodo. Lobortis auctor congue commodo diam neque.",
		icon: ArrowPathIcon,
	},
	{
		name: "Advanced security",
		description:
			"Arcu egestas dolor vel iaculis in ipsum mauris. Tincidunt mattis aliquet hac quis. Id hac maecenas ac donec pharetra eget.",
		icon: FingerPrintIcon,
	},
];
</script>
