import type { Meta, StoryObj } from '@storybook/react';
import AsideWrapper from './AsideWrapper';

const meta = {
  title: 'Components/Aside',
  component: AsideWrapper,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['tip', 'caution', 'danger', 'info'],
    },
  },
} satisfies Meta<typeof AsideWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tip: Story = {
  args: {
    variant: 'tip',
    children: (
      <p>
        This is a helpful tip! You can use keyboard shortcuts like <code>Ctrl+K</code> to open the command palette.
      </p>
    ),
  },
};

export const Caution: Story = {
  args: {
    variant: 'caution',
    children: (
      <p>
        Be careful when running this command. Make sure you have backed up your data before proceeding.
      </p>
    ),
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: (
      <p>
        <strong>Warning:</strong> This action is irreversible! Once deleted, the data cannot be recovered.
      </p>
    ),
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: (
      <div>
        <p>
          For more information about this feature, check out our <a href="#">documentation</a>.
        </p>
        <p>
          You can also join our <a href="#">Discord community</a> for help.
        </p>
      </div>
    ),
  },
};

export const AllVariants: Story = {
  args: {
    variant: 'info',
    children: null,
  },
  render: () => (
    <div className="space-y-4">
      <AsideWrapper variant="tip">
        <p>This is a tip with helpful information.</p>
      </AsideWrapper>
      <AsideWrapper variant="caution">
        <p>This is a caution message to warn users.</p>
      </AsideWrapper>
      <AsideWrapper variant="danger">
        <p>This is a danger alert for critical warnings.</p>
      </AsideWrapper>
      <AsideWrapper variant="info">
        <p>This is an informational note.</p>
      </AsideWrapper>
    </div>
  ),
};