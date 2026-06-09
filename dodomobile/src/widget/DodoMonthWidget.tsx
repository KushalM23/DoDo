import React from 'react';
import { FlexWidget, TextWidget, SvgWidget, ListWidget, ColorProp } from 'react-native-android-widget';
import {
  getPlusIcon,
  getCheckIcon,
  getChevronLeftIcon,
  getChevronRightIcon,
  getRefreshIcon,
  getCheckCircleIcon,
  getArrowUpCircleIcon,
  getMinusCircleIcon,
  getArrowDownCircleIcon,
  getAppIconSvg,
  getRepeatIcon,
} from './widgetIcons';

export interface WidgetMonthDay {
  dateKey: string;
  dayNum: number;
  isToday: boolean;
  inCurrentMonth: boolean;
}

export interface WidgetItem {
  id: string;
  title: string;
  completed: boolean;
  timeLabel?: string;
  timeMs: number;
  isHabit: boolean;
  priority?: number;
  categoryColor?: string;
  categoryIcon?: string;
  icon?: string;
}

export interface DodoMonthWidgetProps {
  monthLabel: string;
  weekdayInitials: string[];
  days: WidgetMonthDay[];
  selectedDate: string;
  items: WidgetItem[];
  colors: {
    background: ColorProp;
    surface: ColorProp;
    surfaceLight: ColorProp;
    text: ColorProp;
    textSecondary: ColorProp;
    mutedText: ColorProp;
    accent: ColorProp;
    border: ColorProp;
    highPriority: ColorProp;
    mediumPriority: ColorProp;
    lowPriority: ColorProp;
    habitBadge: ColorProp;
  };
}

export function DodoMonthWidget({
  monthLabel,
  weekdayInitials,
  days,
  selectedDate,
  items,
  colors,
}: DodoMonthWidgetProps) {
  const hasItems = items.length > 0;
  const done = items.filter((item) => item.completed).length;
  const total = items.length;

  // Group days into weeks of 7 days
  const weeks: WidgetMonthDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <FlexWidget
      style={{
        flexDirection: 'column',
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 14,
      }}
    >
      {/* Header Row: Month Title + Arrow Nav on the left, Refresh on the right */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: 12,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Left Arrow */}
          <FlexWidget
            clickAction="PREV_MONTH"
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget
              svg={getChevronLeftIcon(colors.mutedText as string)}
              style={{ width: 16, height: 16 }}
            />
          </FlexWidget>

          <TextWidget
            text={monthLabel}
            style={{
              fontSize: 18,
              fontFamily: 'Oswald-Bold',
              color: colors.text,
              letterSpacing: 0.5,
              marginLeft: 4,
              marginRight: 10,
            }}
          />

          {/* Right Arrow */}
          <FlexWidget
            clickAction="NEXT_MONTH"
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget
              svg={getChevronRightIcon(colors.mutedText as string)}
              style={{ width: 16, height: 16 }}
            />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Refresh Button */}
          <FlexWidget
            clickAction="REFRESH_WIDGET"
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget
              svg={getRefreshIcon(colors.accent as string)}
              style={{ width: 18, height: 18 }}
            />
          </FlexWidget>
          {/* Add Button */}
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'dodo://quick-add' }}
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SvgWidget
              svg={getPlusIcon(colors.accent as string)}
              style={{ width: 20, height: 20 }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* Weekday Initials Header Row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 6,
        }}
      >
        {weekdayInitials.map((initial, idx) => (
          <FlexWidget
            key={`initial-${idx}`}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={initial}
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-SemiBold',
                color: colors.mutedText,
              }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* Month Grid Weeks */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        {weeks.map((week, weekIdx) => (
          <FlexWidget
            key={`week-row-${weekIdx}`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: 'match_parent',
              marginBottom: 6,
            }}
          >
            {week.map((day) => {
              const isSelected = day.inCurrentMonth && day.dateKey === selectedDate;
              const bg = isSelected ? colors.text : 'rgba(0, 0, 0, 0)';
              const textColor = !day.inCurrentMonth
                ? 'rgba(0, 0, 0, 0)'
                : isSelected
                ? colors.surface
                : day.isToday
                ? colors.accent
                : colors.text;
              const fontFamily = (day.inCurrentMonth && (isSelected || day.isToday)) ? 'Poppins-Bold' : 'Poppins-SemiBold';

              return (
                <FlexWidget
                  key={`day-col-${day.dateKey}-${day.inCurrentMonth ? 'in' : 'out'}`}
                  {...(day.inCurrentMonth ? { clickAction: 'SELECT_DATE', clickActionData: { date: day.dateKey } } : {})}
                  style={{
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 2,
                  }}
                >
                  <FlexWidget
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TextWidget
                      text={String(day.dayNum)}
                      style={{
                        fontSize: 12,
                        fontFamily: fontFamily,
                        color: textColor,
                      }}
                    />
                  </FlexWidget>
                </FlexWidget>
              );
            })}
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* Progress Bar (exactly like the task page) */}
      {total > 0 && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: 'match_parent',
            marginBottom: 12,
          }}
        >
          {/* Progress track */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.surfaceLight,
              overflow: 'hidden',
            }}
          >
            {done > 0 && (
              <FlexWidget
                style={{
                  flex: done,
                  height: 'match_parent',
                  backgroundColor: colors.accent,
                  borderRadius: 3,
                }}
              />
            )}
            {total - done > 0 && (
              <FlexWidget
                style={{
                  flex: total - done,
                  height: 'match_parent',
                  backgroundColor: colors.surfaceLight,
                }}
              />
            )}
          </FlexWidget>

          {/* Progress Text done/total */}
          <TextWidget
            text={`${done}/${total} done`}
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Bold',
              color: colors.mutedText,
              marginLeft: 10,
            }}
          />
        </FlexWidget>
      )}

      {/* Task/Habit List Container: Scrollable List */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          width: 'match_parent',
          flex: 1,
        }}
      >
        {!hasItems ? (
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 'match_parent',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text="No tasks or habits today."
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: colors.mutedText,
              }}
            />
          </FlexWidget>
        ) : (
          <ListWidget
            style={{
              width: 'match_parent',
              height: 'match_parent',
            }}
          >
            {items.map((item) => {
              if (item.isHabit) {
                // HABITS STYLE:
                // Left checkbox: Check icon when completed; custom habit icon when not completed. Color is always habitBadge.
                // Right badge: Repeat icon. Color is always habitBadge.
                const leadingSvg = item.completed
                  ? getCheckIcon(colors.habitBadge as string)
                  : getAppIconSvg(item.icon || 'repeat', colors.habitBadge as string);

                const rightSvg = getRepeatIcon(colors.habitBadge as string);

                return (
                  <FlexWidget
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 4,
                      width: 'match_parent',
                    }}
                  >
                    {/* Left checkbox icon (like TaskSlab) */}
                    <FlexWidget
                      clickAction="TOGGLE_HABIT"
                      clickActionData={{ id: item.id }}
                      style={{
                        padding: 10,
                        marginRight: 4,
                      }}
                    >
                      <SvgWidget
                        svg={leadingSvg}
                        style={{ width: 20, height: 20 }}
                      />
                    </FlexWidget>

                    {/* Center Title + Subtitle */}
                    <FlexWidget
                      clickAction="OPEN_URI"
                      clickActionData={{ uri: `dodo://habit/${item.id}` }}
                      style={{
                        flex: 1,
                        flexDirection: 'column',
                        paddingVertical: 10,
                      }}
                    >
                      <TextWidget
                        text={item.title}
                        style={{
                          fontSize: 14,
                          fontFamily: 'Oswald-SemiBold',
                          color: item.completed ? colors.mutedText : colors.text,
                        }}
                      />
                      {item.timeLabel ? (
                        <TextWidget
                          text={item.timeLabel}
                          style={{
                            fontSize: 11,
                            fontFamily: 'Poppins-Medium',
                            color: colors.mutedText,
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </FlexWidget>

                    {/* Right Badge: Repeat icon (like TaskSlab) */}
                    <FlexWidget
                      clickAction="OPEN_URI"
                      clickActionData={{ uri: `dodo://habit/${item.id}` }}
                      style={{
                        marginLeft: 6,
                        padding: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <SvgWidget
                        svg={rightSvg}
                        style={{ width: 14, height: 14 }}
                      />
                    </FlexWidget>
                  </FlexWidget>
                );
              } else {
                // TASKS STYLE:
                // Left checkbox: Check icon when completed; category icon (or check-circle) when not completed. Color is always categoryColor (or accent).
                // Right badge: Priority arrow. Color is always priorityColor.
                const priColor =
                  item.priority === 3
                    ? colors.highPriority
                    : item.priority === 2
                    ? colors.mediumPriority
                    : colors.lowPriority;

                const leadingColor = item.categoryColor || (colors.accent as string);
                const leadingSvg = item.completed
                  ? getCheckIcon(leadingColor as string)
                  : (item.categoryIcon
                    ? getAppIconSvg(item.categoryIcon, leadingColor as string)
                    : getCheckCircleIcon(leadingColor as string));

                const rightSvg =
                  item.priority === 3
                    ? getArrowUpCircleIcon(priColor as string)
                    : item.priority === 2
                    ? getMinusCircleIcon(priColor as string)
                    : getArrowDownCircleIcon(priColor as string);

                return (
                  <FlexWidget
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 4,
                      width: 'match_parent',
                    }}
                  >
                    {/* Left checkbox icon (like TaskSlab) */}
                    <FlexWidget
                      clickAction="TOGGLE_TASK"
                      clickActionData={{ id: item.id }}
                      style={{
                        padding: 10,
                        marginRight: 4,
                      }}
                    >
                      <SvgWidget
                        svg={leadingSvg}
                        style={{ width: 20, height: 20 }}
                      />
                    </FlexWidget>

                    {/* Center Title + Subtitle */}
                    <FlexWidget
                      clickAction="OPEN_URI"
                      clickActionData={{ uri: `dodo://task/${item.id}` }}
                      style={{
                        flex: 1,
                        flexDirection: 'column',
                        paddingVertical: 10,
                      }}
                    >
                      <TextWidget
                        text={item.title}
                        style={{
                          fontSize: 14,
                          fontFamily: 'Oswald-SemiBold',
                          color: item.completed ? colors.mutedText : colors.text,
                        }}
                      />
                      {item.timeLabel ? (
                        <TextWidget
                          text={item.timeLabel}
                          style={{
                            fontSize: 11,
                            fontFamily: 'Poppins-Medium',
                            color: colors.mutedText,
                            marginTop: 2,
                          }}
                        />
                      ) : null}
                    </FlexWidget>

                    {/* Right priority badge */}
                    <FlexWidget
                      clickAction="OPEN_URI"
                      clickActionData={{ uri: `dodo://task/${item.id}` }}
                      style={{
                        marginLeft: 6,
                        padding: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <SvgWidget
                        svg={rightSvg}
                        style={{ width: 14, height: 14 }}
                      />
                    </FlexWidget>
                  </FlexWidget>
                );
              }
            })}
          </ListWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
